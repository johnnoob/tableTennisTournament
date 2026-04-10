"""
services/match_service.py

負責 Match 相關的核心商業邏輯與資料庫操作。
Router 層不應包含任何 DB 交易細節，只負責呼叫此 Service 並轉換成 HTTP Response。
"""
from uuid import UUID
from sqlmodel import Session, select
from sqlalchemy import update

from models import Match, User, SeasonRecord, PlayerStatHistory, MatchParticipation, Notification
from services.elo_engine import calculate_match_deltas, ELO_CONFIG


# ── Custom Exceptions（供 Router 捕捉後轉成 HTTPException） ────────────────────

class MatchNotFoundError(Exception):
    pass

class MatchAlreadySettledError(Exception):
    pass

class ConfirmPermissionError(Exception):
    pass


# ── 主要 Service Function ──────────────────────────────────────────────────────

def settle_match_transaction(
    session: Session,
    match_id: UUID,
    current_user_id: UUID,
) -> dict:
    """
    執行比賽確認的完整 DB 交易（單軌 Elo 系統）：
      1. 驗證比賽狀態與確認權限
      2. 依排序取得所有玩家的悲觀鎖（防 Deadlock）
      3. 呼叫 calculate_match_deltas 取得每人的精確積分變動
      4. 原子更新 User.global_mmr 與 SeasonRecord 出賽統計
      5. 寫入 PlayerStatHistory、MatchParticipation
      6. 更新 Match 狀態與通知
      7. commit / rollback on error

    Returns:
        dict with keys: deltas, winner_team, loser_team, winner_new_mmrs, loser_new_mmrs

    Raises:
        MatchNotFoundError: 找不到比賽
        MatchAlreadySettledError: 比賽不處於 pending 狀態
        ConfirmPermissionError: 非對手方不得確認
    """
    # ── 1. 讀取 match（不鎖），做基本驗證 ────────────────────────────────────
    match = session.get(Match, match_id)
    if not match:
        raise MatchNotFoundError(f"match_id={match_id}")
    if match.status != "pending":
        raise MatchAlreadySettledError(f"match status is '{match.status}'")
    if current_user_id not in [match.team_b_p1_id, match.team_b_p2_id]:
        raise ConfirmPermissionError(f"user {current_user_id} is not opponent")

    # ── 2. 收集所有涉及的 user_id，排序後依序取得悲觀鎖 ─────────────────────
    #    ⚠️  排序是防 Deadlock 的關鍵：所有 concurrent request 都以相同順序鎖列
    involved_ids = sorted(filter(None, [
        match.team_a_p1_id,
        match.team_a_p2_id,
        match.team_b_p1_id,
        match.team_b_p2_id,
    ]))

    try:
        # SELECT ... FOR UPDATE：鎖定這些 User 列，其他 transaction 若也想鎖同一列會 block
        locked_users: dict[UUID, User] = {}
        for uid in involved_ids:
            user = session.exec(
                select(User).where(User.id == uid).with_for_update()
            ).one()
            locked_users[uid] = user

        team_a_p1 = locked_users[match.team_a_p1_id]
        team_b_p1 = locked_users[match.team_b_p1_id]
        team_a_p2 = locked_users.get(match.team_a_p2_id) if match.team_a_p2_id else None
        team_b_p2 = locked_users.get(match.team_b_p2_id) if match.team_b_p2_id else None

        # ── 3. 計算每位玩家的精確 Elo delta（使用鎖後的最新 MMR） ───────────
        a_won = match.score_a > match.score_b

        # 勝/敗方分配（calculate_match_deltas 的 winner/loser 視角）
        if a_won:
            winner_p1, winner_p2 = team_a_p1, team_a_p2
            loser_p1,  loser_p2  = team_b_p1, team_b_p2
            score_winner, score_loser = match.score_a, match.score_b
        else:
            winner_p1, winner_p2 = team_b_p1, team_b_p2
            loser_p1,  loser_p2  = team_a_p1, team_a_p2
            score_winner, score_loser = match.score_b, match.score_a

        # 取得勝方 p1 歷史出賽總數（用於決定 K 值）
        winner_p1_total_matches = session.exec(
            select(MatchParticipation).where(MatchParticipation.user_id == winner_p1.id)
        ).all()
        winner_p1_matches_played = len(winner_p1_total_matches)

        deltas = calculate_match_deltas(
            team_winner_p1_mmr=winner_p1.global_mmr,
            team_winner_p2_mmr=winner_p2.global_mmr if winner_p2 else None,
            team_loser_p1_mmr=loser_p1.global_mmr,
            team_loser_p2_mmr=loser_p2.global_mmr if loser_p2 else None,
            winner_p1_matches_played=winner_p1_matches_played,
            score_winner=score_winner,
            score_loser=score_loser,
            format=match.format,
        )

        # 分配個人 delta（依勝負方對應回隊伍A/B）
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

        # 記錄到 match（mmr_exchanged 用勝方 p1 的 delta 作為代表）
        match.mmr_exchanged = deltas["winner_p1_delta"]
        session.add(match)

        # ── 4. 更新每位玩家的積分（User + SeasonRecord） ──────────────────────
        def _update_player_stats(player: User, is_winner: bool, team_name: str) -> None:
            actual_delta = delta_map[player.id]

            # 4a. 原子更新 global_mmr（直接讓 DB 做加法，不在 Python 做 read-modify-write）
            session.exec(
                update(User)
                .where(User.id == player.id)
                .values(global_mmr=User.global_mmr + actual_delta)
            )
            # 讓 ORM 物件也反映新值（供回傳用）
            player.global_mmr += actual_delta

            # 4b. 取得並鎖定 SeasonRecord
            season_record = session.exec(
                select(SeasonRecord)
                .where(
                    SeasonRecord.user_id == player.id,
                    SeasonRecord.season_id == match.season_id,
                )
                .with_for_update()
            ).first()

            if season_record:
                # 4b-i. 原子更新 SeasonRecord 出賽統計
                session.exec(
                    update(SeasonRecord)
                    .where(
                        SeasonRecord.user_id == player.id,
                        SeasonRecord.season_id == match.season_id,
                    )
                    .values(
                        matches_played=SeasonRecord.matches_played + 1,
                        wins=SeasonRecord.wins + (1 if is_winner else 0),
                    )
                )

            else:
                # 4b-ii. 第一次打這個賽季，INSERT 新紀錄
                season_record = SeasonRecord(
                    user_id=player.id,
                    season_id=match.season_id,
                    matches_played=1,
                    wins=1 if is_winner else 0,
                )
                session.add(season_record)

            # 4c. 寫入 history snapshot
            session.add(PlayerStatHistory(
                user_id=player.id,
                mmr=player.global_mmr,
            ))

            # 4d. 寫入 participation
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

        # ── 5. 更新 match 狀態 & 通知 ────────────────────────────────────────
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

        session.commit()

    except Exception:
        session.rollback()
        raise

    return {
        "deltas": deltas,
        "delta": deltas["winner_p1_delta"],  # backward-compat key
        "team_a_new_mmr": team_a_p1.global_mmr,
        "team_b_new_mmr": team_b_p1.global_mmr,
    }
