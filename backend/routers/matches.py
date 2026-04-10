from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_
from sqlalchemy import update
from uuid import UUID
import datetime

from database import get_session
from models import Match, Season, Notification, User, PlayerStatHistory, MatchParticipation, SeasonRecord
from schemas import MatchCreateReq

# 🌟 匯入我們的 Elo 引擎
from services.elo_engine import get_team_mmr, calculate_elo_delta
from services.auth_jwt import get_current_user # 🌟 匯入警衛
from services.season_service import get_current_season, ensure_utc

router = APIRouter(tags=["Matches"])

@router.post("/api/matches", summary="發起報分 (進入 Pending 狀態)")
def report_match(req: MatchCreateReq, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    real_reporter_id = current_user.id

    # 1. 🔍 尋找當前進行中的賽季
    from services.season_service import is_season_paused
    if is_season_paused(session):
        raise HTTPException(status_code=403, detail="積分賽季目前處於暫停狀態，暫時無法報分！")

    current_season = get_current_season(session)
    
    if not current_season:
        raise HTTPException(status_code=400, detail="目前沒有進行中的賽季，無法報分！")

    # 2. 📝 建立對戰紀錄 (狀態預設為 pending)
    new_match = Match(
        match_type=req.match_type,
        format=req.format,
        team_a_p1_id=req.team_a_p1_id,
        team_a_p2_id=req.team_a_p2_id,
        team_b_p1_id=req.team_b_p1_id,
        team_b_p2_id=req.team_b_p2_id,
        score_a=req.score_a,
        score_b=req.score_b,
        reported_by=req.reported_by,
        season_id=current_season.id,
        status="pending"
    )
    session.add(new_match)
    session.flush()

    # 3. 🔔 建立通知發送給對手
    reporter = session.get(User, req.reported_by)
    reporter_name = reporter.name if reporter else "某位同仁"

    notification = Notification(
        user_id=req.team_b_p1_id,
        match_id=new_match.id,
        type="pending_confirm",
        content=f"{reporter_name} 剛剛送出了一筆 {req.score_a}:{req.score_b} 的比分，請您確認。",
        is_read=False
    )
    session.add(notification)

    if req.team_b_p2_id:
        notification_p2 = Notification(
            user_id=req.team_b_p2_id,
            match_id=new_match.id,
            type="pending_confirm",
            content=f"{reporter_name} 剛剛送出了一筆雙打比分，請您確認。",
            is_read=False
        )
        session.add(notification_p2)

    session.commit()
    session.refresh(new_match)

    return {
        "message": "報分已送出，等待對手確認中！",
        "match_id": new_match.id
    }

@router.delete("/api/matches/{match_id}", summary="撤回待確認比賽")
def retract_match(match_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    if match.status != "pending":
        raise HTTPException(status_code=400, detail="此比賽已確認或已結算，無法撤回")
    if current_user.id not in [match.team_a_p1_id, match.team_a_p2_id] or match.reported_by != current_user.id:
        raise HTTPException(status_code=403, detail="只有申報者可以撤回此比賽")

    notifs = session.exec(select(Notification).where(Notification.match_id == match.id)).all()
    for n in notifs:
        session.delete(n)

    session.delete(match)
    session.commit()
    return {"message": "已成功撤回申報"}

@router.patch("/api/matches/{match_id}", summary="修改待確認比賽比分")
def update_match_score(match_id: UUID, req: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    if match.status != "pending":
        raise HTTPException(status_code=400, detail="此比賽已確認，無法修改")
    if match.reported_by != current_user.id:
        raise HTTPException(status_code=403, detail="只有申報者可以修改此比賽")

    if "score_a" in req:
        match.score_a = int(req["score_a"])
    if "score_b" in req:
        match.score_b = int(req["score_b"])

    session.add(match)
    session.commit()
    return {"message": "比分已更新", "score_a": match.score_a, "score_b": match.score_b}

@router.post("/api/matches/{match_id}/confirm", summary="確認比分並結算積分 (觸發 Elo 引擎)")
def confirm_match(match_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # ── 1. 先讀取 match（不鎖），做基本驗證 ──────────────────────────────
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    if match.status != "pending":
        raise HTTPException(status_code=400, detail="此比賽不處於待確認狀態")
    if current_user.id not in [match.team_b_p1_id, match.team_b_p2_id]:
        raise HTTPException(status_code=403, detail="只有對手可以確認此比分！")

    # ── 2. 收集所有涉及的 user_id，排序後依序取得悲觀鎖 ─────────────────
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

        # ── 3. 計算 Elo delta（使用鎖後的最新 MMR） ─────────────────────────
        a_won = match.score_a > match.score_b

        delta = calculate_elo_delta(
            winner_team_mmr=team_a_p1.global_mmr if a_won else team_b_p1.global_mmr,
            loser_team_mmr=team_b_p1.global_mmr if a_won else team_a_p1.global_mmr,
            winner_matches_played=10,
            score_winner=max(match.score_a, match.score_b),
            score_loser=min(match.score_a, match.score_b),
            format=match.format,
        )

        match.mmr_exchanged = delta
        match.lp_exchanged = delta
        session.add(match)

        # ── 4. 更新每位玩家的積分（User + SeasonRecord） ─────────────────────
        def update_player_stats(player: User, is_winner: bool, team_name: str):
            actual_delta = delta if is_winner else -delta

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
                # 原子更新 season_lp
                session.exec(
                    update(SeasonRecord)
                    .where(
                        SeasonRecord.user_id == player.id,
                        SeasonRecord.season_id == match.season_id,
                    )
                    .values(
                        season_lp=SeasonRecord.season_lp + actual_delta,
                        matches_played=SeasonRecord.matches_played + 1,
                        wins=SeasonRecord.wins + (1 if is_winner else 0),
                    )
                )
                # 讓 ORM 物件反映新值（供 history 用）
                season_record.season_lp += actual_delta
                current_lp = season_record.season_lp
            else:
                # 第一次打這個賽季，INSERT 新紀錄（無需鎖，因為 INSERT 不存在競爭）
                season_record = SeasonRecord(
                    user_id=player.id,
                    season_id=match.season_id,
                    season_lp=1200 + actual_delta,
                    matches_played=1,
                    wins=1 if is_winner else 0,
                )
                session.add(season_record)
                current_lp = season_record.season_lp

            # 4c. 寫入 history snapshot
            history = PlayerStatHistory(
                user_id=player.id,
                mmr=player.global_mmr,
                season_lp=current_lp,
            )
            session.add(history)

            # 4d. 寫入 participation
            participation = MatchParticipation(
                match_id=match.id,
                user_id=player.id,
                team=team_name,
                is_winner=is_winner,
                mmr_delta=actual_delta,
                lp_delta=actual_delta,
            )
            session.add(participation)

        update_player_stats(team_a_p1, is_winner=a_won, team_name="A")
        if team_a_p2:
            update_player_stats(team_a_p2, is_winner=a_won, team_name="A")
        update_player_stats(team_b_p1, is_winner=not a_won, team_name="B")
        if team_b_p2:
            update_player_stats(team_b_p2, is_winner=not a_won, team_name="B")

        # ── 5. 更新 match 狀態 & 通知 ──────────────────────────────────────
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
        "message": "比分已確認，積分結算完畢！",
        "delta": delta,
        "team_a_new_mmr": team_a_p1.global_mmr,
        "team_b_new_mmr": team_b_p1.global_mmr,
    }

@router.get("/api/matches/pending", summary="取得我相關的待確認比賽")
def get_pending_matches(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Match).where(
        Match.status == "pending",
        or_(
            Match.team_a_p1_id == current_user.id,
            Match.team_a_p2_id == current_user.id,
            Match.team_b_p1_id == current_user.id,
            Match.team_b_p2_id == current_user.id
        )
    ).order_by(Match.created_at.desc())
    
    pending_matches = session.exec(statement).all()
    
    result = []
    for m in pending_matches:
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)
        team_a_p2 = session.get(User, m.team_a_p2_id) if m.team_a_p2_id else None
        team_b_p2 = session.get(User, m.team_b_p2_id) if m.team_b_p2_id else None

        potential_delta = calculate_elo_delta(
            winner_team_mmr=team_a_p1.global_mmr if m.score_a > m.score_b else team_b_p1.global_mmr,
            loser_team_mmr=team_b_p1.global_mmr if m.score_a > m.score_b else team_a_p1.global_mmr,
            winner_matches_played=10,
            score_winner=max(m.score_a, m.score_b),
            score_loser=min(m.score_a, m.score_b),
            format=m.format
        )
        
        player1_data = [{"id": str(team_a_p1.id), "name": team_a_p1.name, "avatar": team_a_p1.avatar_url}]
        opponent_data = [{"id": str(team_b_p1.id), "name": team_b_p1.name, "avatar": team_b_p1.avatar_url}]

        if m.match_type == "doubles":
            if team_a_p2: player1_data.append({"id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url})
            if team_b_p2: opponent_data.append({"id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url})

        expires_at = m.created_at + datetime.timedelta(hours=48)
        a_change = potential_delta if m.score_a > m.score_b else -potential_delta
        b_change = -potential_delta if m.score_a > m.score_b else potential_delta

        result.append({
            "id": str(m.id),
            "date": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "created_at": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "score": [m.score_a, m.score_b],
            "result": "win" if m.score_a > m.score_b else "loss",
            "status": m.status,
            "type": m.match_type if m.match_type else "singles",
            "mmrChange": [a_change, b_change],
            "player1": player1_data,
            "opponent": opponent_data,
            "submittedBy": str(m.reported_by),
            "expiresAt": expires_at.isoformat()
        })
        
    return result

@router.get("/api/users/me/matches", summary="取得我的個人完整對戰紀錄")
def get_my_matches(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 20,
    offset: int = 0,
    result_filter: str = "all"
):
    statement = select(Match).where(
        or_(
            Match.team_a_p1_id == current_user.id,
            Match.team_a_p2_id == current_user.id,
            Match.team_b_p1_id == current_user.id,
            Match.team_b_p2_id == current_user.id
        )
    ).order_by(Match.created_at.desc())

    all_matches = session.exec(statement).all()

    result = []
    for m in all_matches:
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)
        if not team_a_p1 or not team_b_p1:
            continue

        i_am_team_a = current_user.id in [m.team_a_p1_id, m.team_a_p2_id]
        a_won = m.score_a > m.score_b
        i_won = (i_am_team_a and a_won) or (not i_am_team_a and not a_won)
        my_result = "win" if i_won else "loss"

        if result_filter == "win" and not i_won: continue
        if result_filter == "loss" and i_won: continue

        player1_data = [{"id": str(team_a_p1.id), "name": team_a_p1.name, "avatar": team_a_p1.avatar_url}]
        opponent_data = [{"id": str(team_b_p1.id), "name": team_b_p1.name, "avatar": team_b_p1.avatar_url}]

        team_a_p2 = None
        team_b_p2 = None
        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = session.get(User, m.team_a_p2_id)
                if team_a_p2: player1_data.append({"id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url})
            if m.team_b_p2_id:
                team_b_p2 = session.get(User, m.team_b_p2_id)
                if team_b_p2: opponent_data.append({"id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url})

        delta = m.lp_exchanged if m.lp_exchanged else 0
        a_change = round(delta) if a_won else -round(delta)
        b_change = -round(delta) if a_won else round(delta)

        result.append({
            "id": str(m.id),
            "date": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "created_at": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "score": [m.score_a, m.score_b],
            "result": my_result,
            "status": m.status,
            "type": m.match_type if m.match_type else "singles",
            "tournament": "雙打積分賽" if m.match_type == "doubles" else "單打積分賽",
            "mmrChange": [a_change, b_change],
            "player1": player1_data,
            "opponent": opponent_data,
        })

    total = len(result)
    paginated = result[offset: offset + limit]
    return {"total": total, "matches": paginated, "hasMore": (offset + limit) < total}

@router.get("/api/matches/recent", summary="取得最近的比賽紀錄 (Recent Feed)")
def get_recent_matches(limit: int = 5, session: Session = Depends(get_session)):
    statement = select(Match).order_by(Match.created_at.desc()).limit(limit)
    recent_matches = session.exec(statement).all()
    
    result = []
    for m in recent_matches:
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)
        
        if not team_a_p1 or not team_b_p1: continue

        player1_data = [{"id": str(team_a_p1.id), "name": team_a_p1.name, "avatar": team_a_p1.avatar_url}]
        opponent_data = [{"id": str(team_b_p1.id), "name": team_b_p1.name, "avatar": team_b_p1.avatar_url}]

        team_a_p2 = None
        team_b_p2 = None
        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = session.get(User, m.team_a_p2_id)
                if team_a_p2: player1_data.append({"id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url})
            if m.team_b_p2_id:
                team_b_p2 = session.get(User, m.team_b_p2_id)
                if team_b_p2: opponent_data.append({"id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url})

        is_a_win = m.score_a > m.score_b
        if m.status in ["confirmed", "completed"] and m.mmr_exchanged is not None:
            delta = m.mmr_exchanged
        else:
            mmr_a = get_team_mmr(team_a_p1.global_mmr, (team_a_p2.global_mmr if team_a_p2 else None))
            mmr_b = get_team_mmr(team_b_p1.global_mmr, (team_b_p2.global_mmr if team_b_p2 else None))
            delta = calculate_elo_delta(
                winner_team_mmr=mmr_a if is_a_win else mmr_b,
                loser_team_mmr=mmr_b if is_a_win else mmr_a,
                winner_matches_played=10,
                score_winner=max(m.score_a, m.score_b),
                score_loser=min(m.score_a, m.score_b),
                format=m.format
            )

        mmr_change = [delta, -delta] if is_a_win else [-delta, delta]

        result.append({
            "id": str(m.id),
            "date": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"), 
            "created_at": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "score": [m.score_a, m.score_b],
            "result": "win" if is_a_win else "loss",
            "status": m.status,
            "type": m.match_type if m.match_type else "singles",
            "tournament": "雙打積分賽" if m.match_type == "doubles" else "單打積分賽",
            "mmrChange": mmr_change,
            "player1": player1_data,
            "opponent": opponent_data
        })
        
    return result