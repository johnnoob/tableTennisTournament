"""
services/match_service.py

負責 Match 相關的核心商業邏輯與資料庫操作。
Router 層不應包含任何 DB 交易細節，只負責呼叫此 Service 並轉換成 HTTP Response。
"""
from datetime import datetime, timezone
from uuid import UUID
from sqlmodel import Session, select
from sqlalchemy import func

from models import Match, User, SeasonRecord, PlayerStatHistory, MatchParticipation, Notification
from services.elo_engine import calculate_match_deltas
from services.season_service import ensure_utc


# ── Custom Exceptions（供 Router 捕捉後轉成 HTTPException） ────────────────────

class MatchNotFoundError(Exception):
    pass

class MatchAlreadySettledError(Exception):
    pass

class ConfirmPermissionError(Exception):
    pass


# ── 內部共用結算 Helper ──────────────────────────────────────────────────────

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

        for match in ordered_matches:
            settled = _settle_locked_match(session, match, locked_users)
            my_delta = settled["delta_map"][current_user_id]
            current_user_total_delta += my_delta
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
                        f"{current_user.name} 對 {match.score_a}:{match.score_b} "
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
                        f"【賽事申訴】{current_user.name} 對 {match.score_a}:{match.score_b} "
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
                        f"【賽事申訴】{current_user.name} 對 {match.score_a}:{match.score_b} "
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
        for uid in involved_ids:
            session.add(
                Notification(
                    user_id=uid,
                    match_id=match.id,
                    type="match_confirmed",
                    content=(
                        f"管理員 {admin_user.name} 已裁決確認對戰賽果（{match.score_a}:{match.score_b}）"
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

        for uid in involved_ids:
            if uid not in locked_users:
                continue
            if was_settled:
                rb = rolled_back_deltas.get(uid, 0.0)
                rb_str = f"{rb:+.1f}" if abs(rb) >= 0.05 else "0.0"
                content = (
                    f"管理員 {admin_user.name} 已撤銷一筆已結算對戰（{score_label}），"
                    f"並回滾戰績與 ELO（{rb_str}）{reason_suffix}。"
                )
            else:
                content = (
                    f"管理員 {admin_user.name} 已駁回並移除一筆對戰報分（{score_label}）"
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
