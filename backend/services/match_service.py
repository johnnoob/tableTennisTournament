"""
services/match_service.py

負責 Match 相關的核心商業邏輯與資料庫操作。
Router 層不應包含任何 DB 交易細節，只負責呼叫此 Service 並轉換成 HTTP Response。
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlmodel import Session, select
from sqlalchemy import func

from config import settings
from models import (
    Match,
    MatchParticipation,
    Notification,
    PlayerStatHistory,
    Season,
    SeasonRecord,
    User,
)
from services.elo_engine import calculate_match_deltas
from services.season_service import ensure_utc, get_config_value, get_current_season


# ── Custom Exceptions（供 Router 捕捉後轉成 HTTPException） ────────────────────

class MatchNotFoundError(Exception):
    pass

class MatchAlreadySettledError(Exception):
    pass

class ConfirmPermissionError(Exception):
    pass


# ── 內部共用結算 Helper ──────────────────────────────────────────────────────

def _format_match_brief(match: Match, users_map: dict[UUID, User]) -> str:
    """組合精簡但可辨識場次的對戰摘要標籤：【單打/雙打 #xxxx｜A隊 vs B隊】。"""
    type_label = "雙打" if match.match_type == "doubles" else "單打"
    short_id = str(match.id)[:4]

    team_a_names = [
        users_map[uid].name
        for uid in (match.team_a_p1_id, match.team_a_p2_id)
        if uid is not None and uid in users_map
    ]
    team_b_names = [
        users_map[uid].name
        for uid in (match.team_b_p1_id, match.team_b_p2_id)
        if uid is not None and uid in users_map
    ]

    a_label = " / ".join(team_a_names) if team_a_names else "A隊"
    b_label = " / ".join(team_b_names) if team_b_names else "B隊"
    return f"【{type_label} #{short_id}｜{a_label} vs {b_label}】"


def _settle_locked_match(
    session: Session,
    match: Match,
    locked_users: dict[UUID, User],
) -> dict:
    """
    對已完成悲觀鎖定且驗證通過的單場 Match 執行結算，並 flush 至當前交易。
    不負責 commit / rollback，方便單筆與批次共用。
    """
    team_a_p1 = locked_users[match.team_a_p1_id]
    team_b_p1 = locked_users[match.team_b_p1_id]
    team_a_p2 = locked_users.get(match.team_a_p2_id) if match.team_a_p2_id else None
    team_b_p2 = locked_users.get(match.team_b_p2_id) if match.team_b_p2_id else None

    a_won = match.score_a > match.score_b

    if a_won:
        winner_p1, winner_p2 = team_a_p1, team_a_p2
        loser_p1, loser_p2 = team_b_p1, team_b_p2
        score_winner, score_loser = match.score_a, match.score_b
    else:
        winner_p1, winner_p2 = team_b_p1, team_b_p2
        loser_p1, loser_p2 = team_a_p1, team_a_p2
        score_winner, score_loser = match.score_b, match.score_a

    def _career_matches(player: User) -> int:
        return session.exec(
            select(func.count(MatchParticipation.id))
            .where(MatchParticipation.user_id == player.id)
        ).one()

    deltas = calculate_match_deltas(
        team_winner_p1_mmr=winner_p1.global_mmr,
        team_winner_p2_mmr=winner_p2.global_mmr if winner_p2 else None,
        team_loser_p1_mmr=loser_p1.global_mmr,
        team_loser_p2_mmr=loser_p2.global_mmr if loser_p2 else None,
        winner_p1_matches=_career_matches(winner_p1),
        winner_p2_matches=_career_matches(winner_p2) if winner_p2 else None,
        loser_p1_matches=_career_matches(loser_p1),
        loser_p2_matches=_career_matches(loser_p2) if loser_p2 else None,
        score_winner=score_winner,
        score_loser=score_loser,
        format=match.format,
    )

    if a_won:
        delta_map: dict[UUID, float] = {
            team_a_p1.id: deltas["winner_p1_delta"],
            team_b_p1.id: deltas["loser_p1_delta"],
        }
        if team_a_p2:
            delta_map[team_a_p2.id] = deltas["winner_p2_delta"]
        if team_b_p2:
            delta_map[team_b_p2.id] = deltas["loser_p2_delta"]
    else:
        delta_map = {
            team_b_p1.id: deltas["winner_p1_delta"],
            team_a_p1.id: deltas["loser_p1_delta"],
        }
        if team_b_p2:
            delta_map[team_b_p2.id] = deltas["winner_p2_delta"]
        if team_a_p2:
            delta_map[team_a_p2.id] = deltas["loser_p2_delta"]

    match.mmr_exchanged = deltas["winner_p1_delta"]
    session.add(match)

    def _update_player_stats(player: User, is_winner: bool, team_name: str) -> None:
        actual_delta = delta_map[player.id]
        player.global_mmr += actual_delta
        session.add(player)

        season_record = session.exec(
            select(SeasonRecord)
            .where(
                SeasonRecord.user_id == player.id,
                SeasonRecord.season_id == match.season_id,
            )
            .with_for_update()
        ).first()

        if season_record:
            season_record.matches_played += 1
            season_record.wins += (1 if is_winner else 0)
            session.add(season_record)
        else:
            season_record = SeasonRecord(
                user_id=player.id,
                season_id=match.season_id,
                matches_played=1,
                wins=1 if is_winner else 0,
            )
            session.add(season_record)

        session.add(PlayerStatHistory(
            user_id=player.id,
            mmr=player.global_mmr,
            match_id=match.id,
        ))

        session.add(MatchParticipation(
            match_id=match.id,
            user_id=player.id,
            team=team_name,
            is_winner=is_winner,
            mmr_delta=actual_delta,
        ))

    _update_player_stats(team_a_p1, is_winner=a_won, team_name="A")
    if team_a_p2:
        _update_player_stats(team_a_p2, is_winner=a_won, team_name="A")
    _update_player_stats(team_b_p1, is_winner=not a_won, team_name="B")
    if team_b_p2:
        _update_player_stats(team_b_p2, is_winner=not a_won, team_name="B")

    match.status = "confirmed"
    session.add(match)

    pending_notifs = session.exec(
        select(Notification).where(
            Notification.match_id == match.id,
            Notification.type == "pending_confirm",
        )
    ).all()
    for notif in pending_notifs:
        notif.is_read = True
        session.add(notif)

    # Flush 確保同一批交易的下一場能讀到更新後的生涯場次與 SeasonRecord
    session.flush()

    return {
        "deltas": deltas,
        "delta_map": delta_map,
        "team_a_new_mmr": team_a_p1.global_mmr,
        "team_b_new_mmr": team_b_p1.global_mmr,
    }


# ── 主要 Service Function ──────────────────────────────────────────────────────

def settle_match_transaction(
    session: Session,
    match_id: UUID,
    current_user_id: UUID,
    auto_confirmed: bool = False,
    threshold_label: str = "",
) -> dict:
    """
    執行單場比賽確認的完整 DB 交易（單軌 Elo 系統）。
    """
    match = session.exec(
        select(Match).where(Match.id == match_id).with_for_update()
    ).one_or_none()

    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")
    if match.status != "pending":
        raise MatchAlreadySettledError(f"match status is '{match.status}'")
    if current_user_id not in [match.team_b_p1_id, match.team_b_p2_id]:
        raise ConfirmPermissionError(f"user {current_user_id} is not opponent")

    involved_ids = sorted(filter(None, [
        match.team_a_p1_id,
        match.team_a_p2_id,
        match.team_b_p1_id,
        match.team_b_p2_id,
    ]))

    try:
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            user = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one()
            locked_users[uid] = user

        settled = _settle_locked_match(session, match, locked_users)
        brief = _format_match_brief(match, locked_users)

        if auto_confirmed:
            label = threshold_label or "時限"
            for uid in involved_ids:
                my_delta = settled["delta_map"].get(uid, 0.0)
                session.add(
                    Notification(
                        user_id=uid,
                        match_id=match.id,
                        type="match_confirmed",
                        content=(
                            f"{brief} 對戰（{match.score_a}:{match.score_b}）因超過 {label} 未確認，"
                            f"已由系統自動完成結算（{my_delta:+.1f} ELO）。"
                        ),
                    )
                )
        else:
            confirmer = locked_users.get(current_user_id)
            confirmer_name = confirmer.name if confirmer else "對手"
            for uid in involved_ids:
                if uid == current_user_id:
                    continue
                my_delta = settled["delta_map"].get(uid, 0.0)
                session.add(
                    Notification(
                        user_id=uid,
                        match_id=match.id,
                        type="match_confirmed",
                        content=(
                            f"{confirmer_name} 已確認對戰賽果 {brief}（{match.score_a}:{match.score_b}），"
                            f"本場積分結算 {my_delta:+.1f} ELO。"
                        ),
                    )
                )

        session.commit()

    except Exception:
        session.rollback()
        raise

    return {
        "deltas": settled["deltas"],
        "delta": settled["deltas"]["winner_p1_delta"],  # backward-compat key
        "team_a_new_mmr": settled["team_a_new_mmr"],
        "team_b_new_mmr": settled["team_b_new_mmr"],
    }


def settle_matches_batch_transaction(
    session: Session,
    match_ids: list[UUID],
    current_user_id: UUID,
) -> dict:
    """
    在單一 DB 交易內依建立時間先後順序批次結算多筆待確認比賽，
    確保連打多場的動態 Elo 與生涯出賽數精準連貫且全成功或全回滾。
    """
    unique_ids = list(dict.fromkeys(match_ids))
    if not unique_ids:
        raise ValueError("請至少選擇一場待確認比賽")

    sorted_match_ids = sorted(unique_ids)

    try:
        locked_matches = session.exec(
            select(Match)
            .where(Match.id.in_(sorted_match_ids))
            .order_by(Match.id)
            .with_for_update()
        ).all()

        if len(locked_matches) != len(unique_ids):
            found_ids = {m.id for m in locked_matches}
            missing = [str(mid) for mid in unique_ids if mid not in found_ids]
            raise MatchNotFoundError(f"missing match_ids={missing}")

        for match in locked_matches:
            if match.status != "pending":
                raise MatchAlreadySettledError(f"match {match.id} status is '{match.status}'")
            if current_user_id not in [match.team_b_p1_id, match.team_b_p2_id]:
                raise ConfirmPermissionError(f"user {current_user_id} is not opponent for match {match.id}")

        involved_ids = sorted({
            uid
            for m in locked_matches
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id)
            if uid is not None
        })

        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            user = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one()
            locked_users[uid] = user

        min_dt = datetime.min.replace(tzinfo=timezone.utc)
        ordered_matches = sorted(
            locked_matches,
            key=lambda m: (ensure_utc(m.created_at) or min_dt, str(m.id)),
        )

        settled_items: list[dict] = []
        current_user_total_delta = 0.0

        confirmer = locked_users.get(current_user_id)
        confirmer_name = confirmer.name if confirmer else "對手"

        for match in ordered_matches:
            settled = _settle_locked_match(session, match, locked_users)
            brief = _format_match_brief(match, locked_users)
            my_delta = settled["delta_map"][current_user_id]
            current_user_total_delta += my_delta

            for uid in (
                match.team_a_p1_id,
                match.team_a_p2_id,
                match.team_b_p1_id,
                match.team_b_p2_id,
            ):
                if uid is not None and uid != current_user_id:
                    p_delta = settled["delta_map"].get(uid, 0.0)
                    session.add(
                        Notification(
                            user_id=uid,
                            match_id=match.id,
                            type="match_confirmed",
                            content=(
                                f"{confirmer_name} 已確認對戰賽果 {brief}（{match.score_a}:{match.score_b}），"
                                f"本場積分結算 {p_delta:+.1f} ELO。"
                            ),
                        )
                    )

            settled_items.append({
                "match_id": str(match.id),
                "my_delta": round(my_delta, 1),
                "delta": settled["deltas"]["winner_p1_delta"],
                "deltas": settled["deltas"],
            })

        session.commit()

    except Exception:
        session.rollback()
        raise

    return {
        "confirmed_count": len(settled_items),
        "current_user_total_delta": round(current_user_total_delta, 1),
        "current_user_new_mmr": round(locked_users[current_user_id].global_mmr, 1),
        "results": settled_items,
    }


def _validate_admin_score(score_a: int, score_b: int) -> str:
    """驗證管理員裁決比分並自動推導對應賽制 (BO3 / BO5)。"""
    if score_a < 0 or score_b < 0:
        raise ValueError("比分不得為負數")
    if score_a == score_b:
        raise ValueError("比分不得為平手，請分出勝負")
    if max(score_a, score_b) > 5:
        raise ValueError("單場勝局上限為 5 局")
    return "BO5" if (score_a + score_b >= 5 or max(score_a, score_b) >= 3) else "BO3"


def dispute_match_transaction(
    session: Session,
    match_id: UUID,
    current_user: User,
    reason: str,
) -> dict:
    """
    參賽選手對待確認賽果提出異議：將比賽標記為 disputed 以暫停自動結算，
    並通知同場其他選手與活躍管理員進行裁決。
    """
    clean_reason = reason.strip()
    if not clean_reason:
        raise ValueError("請填寫異議原因")

    match = session.exec(
        select(Match).where(Match.id == match_id).with_for_update()
    ).one_or_none()

    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")
    if match.status != "pending":
        raise MatchAlreadySettledError(f"match status is '{match.status}'")

    involved_ids = list(
        dict.fromkeys(
            uid
            for uid in (
                match.team_a_p1_id,
                match.team_a_p2_id,
                match.team_b_p1_id,
                match.team_b_p2_id,
            )
            if uid is not None
        )
    )
    if current_user.id not in involved_ids:
        raise ConfirmPermissionError("僅該場參賽選手可以提出異議")

    involved_users = session.exec(select(User).where(User.id.in_(involved_ids))).all()
    users_map: dict[UUID, User] = {u.id: u for u in involved_users}
    brief = _format_match_brief(match, users_map)

    try:
        match.status = "disputed"
        session.add(match)

        pending_notifs = session.exec(
            select(Notification).where(
                Notification.match_id == match.id,
                Notification.type == "pending_confirm",
            )
        ).all()
        for notif in pending_notifs:
            notif.is_read = True
            session.add(notif)

        notified_ids: set[UUID] = set()
        for uid in involved_ids:
            if uid == current_user.id or uid in notified_ids:
                continue
            session.add(
                Notification(
                    user_id=uid,
                    match_id=match.id,
                    type="match_disputed",
                    content=(
                        f"{current_user.name} 對 {brief}（{match.score_a}:{match.score_b}）"
                        f"賽果提出異議（原因：{clean_reason}），自動結算已暫停，等待管理員裁決。"
                    ),
                )
            )
            notified_ids.add(uid)

        active_admins = session.exec(
            select(User).where(User.role == "admin", User.is_active == True)
        ).all()
        for admin in active_admins:
            if admin.id == current_user.id or admin.id in notified_ids:
                continue
            session.add(
                Notification(
                    user_id=admin.id,
                    match_id=match.id,
                    type="match_disputed",
                    content=(
                        f"【賽事申訴】{current_user.name} 對 {brief}（{match.score_a}:{match.score_b}）"
                        f"賽果提出異議（原因：{clean_reason}），請前往管理主控台裁決。"
                    ),
                )
            )
            notified_ids.add(admin.id)

        # 保底：確保至少留存一筆 match_disputed 通知供裁決中心顯示申訴原因
        if not notified_ids:
            session.add(
                Notification(
                    user_id=match.reported_by,
                    match_id=match.id,
                    type="match_disputed",
                    content=(
                        f"【賽事申訴】{current_user.name} 對 {brief}（{match.score_a}:{match.score_b}）"
                        f"賽果提出異議（原因：{clean_reason}）。"
                    ),
                )
            )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "match_id": str(match.id),
        "status": "disputed",
        "reason": clean_reason,
    }


def admin_force_settle_match(
    session: Session,
    match_id: UUID,
    admin_user: User,
    score_a: int | None = None,
    score_b: int | None = None,
    reason: str | None = None,
) -> dict:
    """
    管理員強制裁決確認待確認或申訴中的對戰（可選修正比分），並執行正式 ELO 結算。
    """
    match = session.exec(
        select(Match).where(Match.id == match_id).with_for_update()
    ).one_or_none()

    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")
    if match.status not in ("pending", "disputed"):
        raise MatchAlreadySettledError(f"match status is '{match.status}'")

    if (score_a is None) != (score_b is None):
        raise ValueError("修正比分時必須同時提供 A 隊與 B 隊局數")

    if score_a is not None and score_b is not None:
        inferred_fmt = _validate_admin_score(score_a, score_b)
        match.score_a = score_a
        match.score_b = score_b
        match.format = inferred_fmt
        session.add(match)
    elif match.score_a == match.score_b:
        raise ValueError("目前比分為平手，請修正比分後再行結算")

    involved_ids = sorted(
        {
            uid
            for uid in (
                match.team_a_p1_id,
                match.team_a_p2_id,
                match.team_b_p1_id,
                match.team_b_p2_id,
            )
            if uid is not None
        }
    )

    try:
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            user = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one_or_none()
            if not user:
                raise ValueError("找不到部分參賽選手資料，無法結算此對戰")
            locked_users[uid] = user

        settled = _settle_locked_match(session, match, locked_users)

        dispute_notifs = session.exec(
            select(Notification).where(
                Notification.match_id == match.id,
                Notification.type == "match_disputed",
            )
        ).all()
        for notif in dispute_notifs:
            notif.is_read = True
            session.add(notif)

        clean_reason = reason.strip() if reason else ""
        note_suffix = f"（備註：{clean_reason}）" if clean_reason else ""
        brief = _format_match_brief(match, locked_users)
        for uid in involved_ids:
            session.add(
                Notification(
                    user_id=uid,
                    match_id=match.id,
                    type="match_confirmed",
                    content=(
                        f"管理員 {admin_user.name} 已裁決確認對戰賽果 {brief}（{match.score_a}:{match.score_b}）"
                        f"並完成積分結算{note_suffix}。"
                    ),
                )
            )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "match_id": str(match.id),
        "status": "confirmed",
        "score_a": match.score_a,
        "score_b": match.score_b,
        "format": match.format,
        "delta": round(settled["deltas"]["winner_p1_delta"], 1),
    }


def admin_void_or_delete_match(
    session: Session,
    match_id: UUID,
    admin_user: User,
    reason: str | None = None,
) -> dict:
    """
    管理員駁回刪除待確認／申訴中比賽，或原子性撤銷已結算比賽並精準回滾雙方 ELO、
    賽季戰績 (SeasonRecord) 與歷史軌跡 (PlayerStatHistory)。
    """
    match = session.exec(
        select(Match).where(Match.id == match_id).with_for_update()
    ).one_or_none()

    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")

    was_settled = match.status in ("confirmed", "completed")
    score_label = f"{match.score_a}:{match.score_b}"

    participations = session.exec(
        select(MatchParticipation).where(MatchParticipation.match_id == match.id)
    ).all()

    involved_ids = sorted(
        {
            uid
            for uid in (
                match.team_a_p1_id,
                match.team_a_p2_id,
                match.team_b_p1_id,
                match.team_b_p2_id,
                *(p.user_id for p in participations),
            )
            if uid is not None
        }
    )

    try:
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            user = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one_or_none()
            if user:
                locked_users[uid] = user

        rolled_back_deltas: dict[UUID, float] = {}

        if was_settled:
            if participations:
                for part in participations:
                    delta = float(part.mmr_delta or 0.0)
                    player = locked_users.get(part.user_id)
                    if player:
                        player.global_mmr = float(player.global_mmr) - delta
                        session.add(player)
                        rolled_back_deltas[player.id] = (
                            rolled_back_deltas.get(player.id, 0.0) - delta
                        )

                    season_rec = session.exec(
                        select(SeasonRecord)
                        .where(
                            SeasonRecord.user_id == part.user_id,
                            SeasonRecord.season_id == match.season_id,
                        )
                        .with_for_update()
                    ).first()
                    if season_rec:
                        season_rec.matches_played = max(0, season_rec.matches_played - 1)
                        if part.is_winner:
                            season_rec.wins = max(0, season_rec.wins - 1)
                        session.add(season_rec)

                    session.delete(part)
            else:
                # 舊資料無 MatchParticipation 時的保底回滾
                a_won = match.score_a > match.score_b
                raw = float(match.mmr_exchanged or 0.0)
                slots = (
                    (match.team_a_p1_id, True),
                    (match.team_a_p2_id, True),
                    (match.team_b_p1_id, False),
                    (match.team_b_p2_id, False),
                )
                for uid, in_team_a in slots:
                    if uid is None:
                        continue
                    is_winner = a_won if in_team_a else (not a_won)
                    delta = raw if is_winner else -raw
                    player = locked_users.get(uid)
                    if player:
                        player.global_mmr = float(player.global_mmr) - delta
                        session.add(player)
                        rolled_back_deltas[player.id] = (
                            rolled_back_deltas.get(player.id, 0.0) - delta
                        )

                    season_rec = session.exec(
                        select(SeasonRecord)
                        .where(
                            SeasonRecord.user_id == uid,
                            SeasonRecord.season_id == match.season_id,
                        )
                        .with_for_update()
                    ).first()
                    if season_rec:
                        season_rec.matches_played = max(0, season_rec.matches_played - 1)
                        if is_winner:
                            season_rec.wins = max(0, season_rec.wins - 1)
                        session.add(season_rec)

            histories = session.exec(
                select(PlayerStatHistory).where(PlayerStatHistory.match_id == match.id)
            ).all()
            for hist in histories:
                session.delete(hist)
        else:
            for part in participations:
                session.delete(part)

        old_notifs = session.exec(
            select(Notification).where(Notification.match_id == match.id)
        ).all()
        for notif in old_notifs:
            session.delete(notif)

        session.flush()
        session.delete(match)
        session.flush()

        clean_reason = reason.strip() if reason else ""
        reason_suffix = f"（原因：{clean_reason}）" if clean_reason else ""
        brief = _format_match_brief(match, locked_users)

        for uid in involved_ids:
            if uid not in locked_users:
                continue
            if was_settled:
                rb = rolled_back_deltas.get(uid, 0.0)
                rb_str = f"{rb:+.1f}" if abs(rb) >= 0.05 else "0.0"
                content = (
                    f"管理員 {admin_user.name} 已撤銷已結算對戰 {brief}（比分 {score_label}），"
                    f"並回滾戰績與 ELO（{rb_str} ELO）{reason_suffix}。"
                )
            else:
                content = (
                    f"管理員 {admin_user.name} 已駁回並移除對戰報分 {brief}（比分 {score_label}）"
                    f"{reason_suffix}。"
                )
            session.add(
                Notification(
                    user_id=uid,
                    match_id=None,
                    type="match_rejected",
                    content=content,
                )
            )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "mode": "rolled_back_confirmed" if was_settled else "deleted_pending",
        "rolled_back_users": len(rolled_back_deltas) if was_settled else 0,
        "score_label": score_label,
    }


def _sync_completed_season_final_mmr(
    session: Session,
    season: Season | None,
    locked_users: dict[UUID, User],
    delta_adjustments: dict[UUID, float],
) -> None:
    """若操作目標屬於已結算賽季，同步維護 SeasonRecord.final_mmr 快照一致性。"""
    if not season or season.status != "completed":
        return

    for uid, adj in delta_adjustments.items():
        season_rec = session.exec(
            select(SeasonRecord)
            .where(
                SeasonRecord.user_id == uid,
                SeasonRecord.season_id == season.id,
            )
            .with_for_update()
        ).first()
        if season_rec:
            if season_rec.final_mmr is not None:
                season_rec.final_mmr = float(season_rec.final_mmr) + float(adj)
            elif uid in locked_users:
                season_rec.final_mmr = float(locked_users[uid].global_mmr)
            session.add(season_rec)


def admin_create_match(
    session: Session,
    admin_user: User,
    season_id: str | None,
    match_type: str,
    team_a_p1_id: UUID,
    team_a_p2_id: UUID | None,
    team_b_p1_id: UUID,
    team_b_p2_id: UUID | None,
    score_a: int,
    score_b: int,
    auto_settle: bool = True,
    reason: str | None = None,
) -> dict:
    """管理員代為補登單／雙打賽果（可選立即原子結算 ELO 或送出待確認）。"""
    if match_type not in ("singles", "doubles"):
        raise ValueError("賽制僅支援 singles 或 doubles")

    if match_type == "singles":
        team_a_p2_id = None
        team_b_p2_id = None
    elif team_a_p2_id is None or team_b_p2_id is None:
        raise ValueError("雙打比賽必須選滿兩隊共 4 位選手")

    raw_ids = [
        uid
        for uid in (team_a_p1_id, team_a_p2_id, team_b_p1_id, team_b_p2_id)
        if uid is not None
    ]
    if len(set(raw_ids)) != len(raw_ids):
        raise ValueError("同一場比賽不能重複選擇相同選手")

    inferred_fmt = _validate_admin_score(score_a, score_b)

    season = (
        session.get(Season, season_id)
        if season_id
        else get_current_season(session)
    )
    if not season:
        raise ValueError(
            "找不到指定的賽季"
            if season_id
            else "目前沒有進行中的賽季，請手動選擇目標賽季"
        )

    involved_ids = sorted(raw_ids)
    try:
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            u = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one_or_none()
            if not u or u.role == "guest":
                raise ValueError("找不到部分指定的選手資料")
            locked_users[uid] = u

        new_match = Match(
            match_type=match_type,
            format=inferred_fmt,
            team_a_p1_id=team_a_p1_id,
            team_a_p2_id=team_a_p2_id,
            team_b_p1_id=team_b_p1_id,
            team_b_p2_id=team_b_p2_id,
            score_a=score_a,
            score_b=score_b,
            reported_by=admin_user.id,
            season_id=season.id,
            status="pending",
        )
        session.add(new_match)
        session.flush()

        clean_reason = reason.strip() if reason else ""
        note_suffix = f"（備註：{clean_reason}）" if clean_reason else ""
        brief = _format_match_brief(new_match, locked_users)

        settled_delta = 0.0
        if auto_settle:
            settled = _settle_locked_match(session, new_match, locked_users)
            settled_delta = round(settled["deltas"]["winner_p1_delta"], 1)
            _sync_completed_season_final_mmr(
                session, season, locked_users, settled["delta_map"]
            )
            for uid in involved_ids:
                session.add(
                    Notification(
                        user_id=uid,
                        match_id=new_match.id,
                        type="match_confirmed",
                        content=(
                            f"管理員 {admin_user.name} 已代為補登對戰賽果 {brief}（{score_a}:{score_b}）"
                            f"並完成積分結算{note_suffix}。"
                        ),
                    )
                )
        else:
            b_ids = [uid for uid in (team_b_p1_id, team_b_p2_id) if uid is not None]
            for uid in b_ids:
                session.add(
                    Notification(
                        user_id=uid,
                        match_id=new_match.id,
                        type="pending_confirm",
                        content=(
                            f"管理員 {admin_user.name} 代為補登了 {brief}（{score_a}:{score_b}）的比分，"
                            f"請您確認{note_suffix}。"
                        ),
                    )
                )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "match_id": str(new_match.id),
        "status": new_match.status,
        "score_a": new_match.score_a,
        "score_b": new_match.score_b,
        "format": new_match.format,
        "season_id": season.id,
        "season_name": season.name,
        "delta": settled_delta,
    }


def admin_edit_settled_match(
    session: Session,
    match_id: UUID,
    admin_user: User,
    score_a: int,
    score_b: int,
    reason: str | None = None,
) -> dict:
    """
    管理員原地更正「已結算」對戰比分並重算本場積分：
    在單一交易內反向扣回舊場次變動 → flush 恢復出賽數 → 套用新比分重算 ELO 並修正歷程快照。
    """
    match = session.exec(
        select(Match).where(Match.id == match_id).with_for_update()
    ).one_or_none()

    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")
    if match.status not in ("confirmed", "completed"):
        raise ValueError("僅已結算對戰支援原地改分重算；待確認比賽請使用裁決結算")

    new_fmt = _validate_admin_score(score_a, score_b)
    if score_a == match.score_a and score_b == match.score_b:
        raise ValueError("新比分與原比分相同，無需變更")

    participations = session.exec(
        select(MatchParticipation).where(MatchParticipation.match_id == match.id)
    ).all()

    match_slot_ids = [
        uid
        for uid in (
            match.team_a_p1_id,
            match.team_a_p2_id,
            match.team_b_p1_id,
            match.team_b_p2_id,
        )
        if uid is not None
    ]
    involved_ids = sorted({*match_slot_ids, *(p.user_id for p in participations)})
    old_score_label = f"{match.score_a}:{match.score_b}"
    season = session.get(Season, match.season_id)

    try:
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            u = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one_or_none()
            if u:
                locked_users[uid] = u

        for req_uid in match_slot_ids:
            if req_uid not in locked_users:
                raise ValueError("找不到部分參賽選手資料，無法重算該場次")

        old_histories = session.exec(
            select(PlayerStatHistory).where(PlayerStatHistory.match_id == match.id)
        ).all()
        orig_recorded_at = (
            old_histories[0].recorded_at
            if old_histories
            else ensure_utc(match.created_at)
        )

        # Step A: 撤銷既有結算影響
        old_deltas: dict[UUID, float] = {}
        if participations:
            for part in participations:
                delta = float(part.mmr_delta or 0.0)
                player = locked_users.get(part.user_id)
                if player:
                    player.global_mmr = float(player.global_mmr) - delta
                    session.add(player)
                    old_deltas[player.id] = old_deltas.get(player.id, 0.0) + delta

                season_rec = session.exec(
                    select(SeasonRecord)
                    .where(
                        SeasonRecord.user_id == part.user_id,
                        SeasonRecord.season_id == match.season_id,
                    )
                    .with_for_update()
                ).first()
                if season_rec:
                    season_rec.matches_played = max(0, season_rec.matches_played - 1)
                    if part.is_winner:
                        season_rec.wins = max(0, season_rec.wins - 1)
                    session.add(season_rec)

                session.delete(part)
        else:
            old_a_won = match.score_a > match.score_b
            raw = float(match.mmr_exchanged or 0.0)
            slots = (
                (match.team_a_p1_id, True),
                (match.team_a_p2_id, True),
                (match.team_b_p1_id, False),
                (match.team_b_p2_id, False),
            )
            for uid, in_team_a in slots:
                if uid is None:
                    continue
                is_winner = old_a_won if in_team_a else (not old_a_won)
                delta = raw if is_winner else -raw
                player = locked_users.get(uid)
                if player:
                    player.global_mmr = float(player.global_mmr) - delta
                    session.add(player)
                    old_deltas[player.id] = old_deltas.get(player.id, 0.0) + delta

                season_rec = session.exec(
                    select(SeasonRecord)
                    .where(
                        SeasonRecord.user_id == uid,
                        SeasonRecord.season_id == match.season_id,
                    )
                    .with_for_update()
                ).first()
                if season_rec:
                    season_rec.matches_played = max(0, season_rec.matches_played - 1)
                    if is_winner:
                        season_rec.wins = max(0, season_rec.wins - 1)
                    session.add(season_rec)

        for hist in old_histories:
            session.delete(hist)

        # Flush 確保 _settle_locked_match 讀取的是扣回後的場次與 MMR
        session.flush()

        # Step B: 套用新比分並重新結算
        match.score_a = score_a
        match.score_b = score_b
        match.format = new_fmt
        session.add(match)

        settled = _settle_locked_match(session, match, locked_users)

        if orig_recorded_at is not None:
            new_histories = session.exec(
                select(PlayerStatHistory).where(PlayerStatHistory.match_id == match.id)
            ).all()
            for hist in new_histories:
                hist.recorded_at = orig_recorded_at
                session.add(hist)

        net_diffs: dict[UUID, float] = {
            uid: float(new_delta) - float(old_deltas.get(uid, 0.0))
            for uid, new_delta in settled["delta_map"].items()
        }
        _sync_completed_season_final_mmr(session, season, locked_users, net_diffs)

        clean_reason = reason.strip() if reason else ""
        note_suffix = f"（備註：{clean_reason}）" if clean_reason else ""
        brief = _format_match_brief(match, locked_users)

        for uid, net_diff in net_diffs.items():
            session.add(
                Notification(
                    user_id=uid,
                    match_id=match.id,
                    type="match_confirmed",
                    content=(
                        f"管理員 {admin_user.name} 已更正對戰比分 {brief}（{old_score_label} → {score_a}:{score_b}）"
                        f"並重新計算積分（淨變動 {net_diff:+.1f} ELO）{note_suffix}。"
                    ),
                )
            )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "match_id": str(match.id),
        "old_score": old_score_label,
        "score_a": score_a,
        "score_b": score_b,
        "format": new_fmt,
        "new_delta": round(settled["deltas"]["winner_p1_delta"], 1),
    }


def admin_batch_force_settle_matches(
    session: Session,
    admin_user: User,
    match_ids: list[UUID] | None = None,
    overdue_only: bool = False,
    season_id: str | None = None,
    reason: str | None = None,
) -> dict:
    """
    管理員在單一交易內批次強制裁決多場待處理比賽（依建立時間順序連貫結算 ELO），
    或一鍵結算目前所有已超時的待確認比賽。
    """
    try:
        if overdue_only:
            auto_confirm_hours = int(
                get_config_value(
                    session,
                    "match_auto_confirm_hours",
                    str(settings.match_auto_confirm_duration),
                )
            )
            now = datetime.now(timezone.utc)
            cutoff = (
                now - timedelta(minutes=settings.match_auto_confirm_duration)
                if settings.cron_test_mode
                else now - timedelta(hours=auto_confirm_hours)
            )
            stmt = select(Match).where(Match.status == "pending")
            if season_id and season_id != "all":
                stmt = stmt.where(Match.season_id == season_id)

            candidates = session.exec(stmt.order_by(Match.id).with_for_update()).all()
            locked_matches = [
                m
                for m in candidates
                if ensure_utc(m.created_at)
                and ensure_utc(m.created_at) <= cutoff
                and m.score_a != m.score_b
            ]
            if not locked_matches:
                raise ValueError("目前沒有已超時的待確認比賽")
        else:
            unique_ids = list(dict.fromkeys(match_ids or []))
            if not unique_ids:
                raise ValueError("請至少選擇一場待處理對戰")

            sorted_ids = sorted(unique_ids)
            locked_matches = list(
                session.exec(
                    select(Match)
                    .where(Match.id.in_(sorted_ids))
                    .order_by(Match.id)
                    .with_for_update()
                ).all()
            )
            if len(locked_matches) != len(unique_ids):
                found = {m.id for m in locked_matches}
                missing = [str(mid) for mid in unique_ids if mid not in found]
                raise MatchNotFoundError(f"missing match_ids={missing}")

            for m in locked_matches:
                if m.status not in ("pending", "disputed"):
                    raise MatchAlreadySettledError(f"match {m.id} status is '{m.status}'")
                if m.score_a == m.score_b:
                    raise ValueError("選取清單中包含平手比分場次，請先單場改分再結算")

        involved_ids = sorted(
            {
                uid
                for m in locked_matches
                for uid in (
                    m.team_a_p1_id,
                    m.team_a_p2_id,
                    m.team_b_p1_id,
                    m.team_b_p2_id,
                )
                if uid is not None
            }
        )
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            u = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one_or_none()
            if not u:
                raise ValueError("找不到部分參賽選手資料，無法完成批次結算")
            locked_users[uid] = u

        min_dt = datetime.min.replace(tzinfo=timezone.utc)
        ordered_matches = sorted(
            locked_matches,
            key=lambda m: (ensure_utc(m.created_at) or min_dt, str(m.id)),
        )

        season_cache: dict[str, Season | None] = {}
        clean_reason = reason.strip() if reason else ""
        note_suffix = f"（備註：{clean_reason}）" if clean_reason else ""

        for m in ordered_matches:
            settled = _settle_locked_match(session, m, locked_users)

            if m.season_id not in season_cache:
                season_cache[m.season_id] = session.get(Season, m.season_id)
            _sync_completed_season_final_mmr(
                session, season_cache[m.season_id], locked_users, settled["delta_map"]
            )

            dispute_notifs = session.exec(
                select(Notification).where(
                    Notification.match_id == m.id,
                    Notification.type == "match_disputed",
                )
            ).all()
            for notif in dispute_notifs:
                notif.is_read = True
                session.add(notif)

            match_player_ids = [
                uid
                for uid in (
                    m.team_a_p1_id,
                    m.team_a_p2_id,
                    m.team_b_p1_id,
                    m.team_b_p2_id,
                )
                if uid is not None
            ]
            brief = _format_match_brief(m, locked_users)
            for uid in match_player_ids:
                session.add(
                    Notification(
                        user_id=uid,
                        match_id=m.id,
                        type="match_confirmed",
                        content=(
                            f"管理員 {admin_user.name} 已批次裁決確認對戰賽果 {brief}"
                            f"（{m.score_a}:{m.score_b}）並完成積分結算{note_suffix}。"
                        ),
                    )
                )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "confirmed_count": len(ordered_matches),
        "match_ids": [str(m.id) for m in ordered_matches],
    }
