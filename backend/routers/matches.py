from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_
from uuid import UUID
import datetime

from database import get_session
from models import Match, MatchChallenge, Notification, User, SeasonRecord, utc_now
from schemas import MatchCreateReq, MatchBatchConfirmReq, MatchDisputeReq

from config import settings
from services.challenge_service import (
    ensure_challenge_table,
    match_participants_fit_challenge,
)
from services.elo_engine import get_team_mmr, calculate_match_deltas
from services.auth_jwt import get_current_user
from services.season_service import (
    ensure_utc,
    get_config_value,
    get_current_season,
    is_lock_on_expire_enabled,
    is_season_expired,
    is_season_paused,
)
from services.match_service import (
    settle_match_transaction,
    settle_matches_batch_transaction,
    dispute_match_transaction,
    MatchNotFoundError,
    MatchAlreadySettledError,
    ConfirmPermissionError,
)
from services.user_service import get_season_match_counts

router = APIRouter(tags=["Matches"])

@router.post("/api/matches", summary="發起報分 (進入 Pending 狀態)")
def report_match(req: MatchCreateReq, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    real_reporter_id = current_user.id

    # 1. 🔍 尋找當前進行中的賽季
    if is_season_paused(session):
        raise HTTPException(status_code=403, detail="積分賽季目前處於暫停狀態，暫時無法報分！")

    current_season = get_current_season(session)

    if not current_season:
        raise HTTPException(status_code=400, detail="目前沒有進行中的賽季，無法報分！")

    if is_lock_on_expire_enabled(session) and is_season_expired(current_season):
        end_utc = ensure_utc(current_season.end_date)
        end_str = end_utc.strftime("%m/%d %H:%M") if end_utc else "截止時刻"
        raise HTTPException(
            status_code=403,
            detail=f"賽季「{current_season.name}」已於 {end_str} 截止新報分，正等待管理員結算並開啟新賽季（既有待確認比賽仍可正常確認）。",
        )

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

    # 若此場比賽由約戰戰帖直接轉入報分，僅在賽制與對陣名單完全吻合時才綁定（避免換人誤標）
    if req.challenge_id:
        ensure_challenge_table()
        challenge = session.get(MatchChallenge, req.challenge_id)
        if (
            challenge is not None
            and challenge.status == "accepted"
            and real_reporter_id
            in (
                challenge.challenger_id,
                challenge.challenged_id,
                challenge.challenger_partner_id,
                challenge.challenged_partner_id,
            )
            and match_participants_fit_challenge(new_match, challenge)
        ):
            new_match.challenge_id = challenge.id
            session.add(new_match)
            challenge.reported_matches_count = (challenge.reported_matches_count or 0) + 1
            challenge.last_match_id = new_match.id
            challenge.updated_at = utc_now()
            session.add(challenge)

    # 3. 🔔 建立通知發送給對手與雙打搭檔
    reporter = session.get(User, req.reported_by)
    reporter_name = reporter.name if reporter else "某位同仁"

    if (
        req.match_type == "doubles"
        and req.team_a_p2_id
        and req.team_a_p2_id != real_reporter_id
    ):
        session.add(
            Notification(
                user_id=req.team_a_p2_id,
                match_id=new_match.id,
                type="pending_confirm",
                content=f"您的搭檔 {reporter_name} 已送出雙打 {req.score_a}:{req.score_b} 報分，正等待對手確認。",
                is_read=False,
            )
        )

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
            content=f"{reporter_name} 剛剛送出了一筆雙打比分（{req.score_a}:{req.score_b}），請您確認。",
            is_read=False
        )
        session.add(notification_p2)

    session.commit()
    session.refresh(new_match)

    return {
        "message": "報分已送出，等待對手確認中！",
        "match_id": new_match.id,
        "linked_challenge_id": str(new_match.challenge_id) if new_match.challenge_id else None,
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

    if match.challenge_id:
        ensure_challenge_table()
        challenge = session.get(MatchChallenge, match.challenge_id)
        if challenge is not None:
            challenge.reported_matches_count = max(0, (challenge.reported_matches_count or 1) - 1)
            if challenge.last_match_id == match.id:
                prev_match = session.exec(
                    select(Match)
                    .where(Match.challenge_id == challenge.id, Match.id != match.id)
                    .order_by(Match.created_at.desc())
                ).first()
                challenge.last_match_id = prev_match.id if prev_match else None
            challenge.updated_at = utc_now()
            session.add(challenge)

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

    if match.score_a < 0 or match.score_b < 0:
        raise HTTPException(status_code=400, detail="比分不得為負數")
    if match.score_a == match.score_b:
        raise HTTPException(status_code=400, detail="比分不得為平手，請分出勝負")

    match.format = (
        "BO5"
        if (match.score_a + match.score_b >= 5 or max(match.score_a, match.score_b) >= 3)
        else "BO3"
    )
    session.add(match)

    old_pending_notifs = session.exec(
        select(Notification).where(
            Notification.match_id == match.id,
            Notification.type == "pending_confirm",
            Notification.user_id.in_(
                [uid for uid in (match.team_b_p1_id, match.team_b_p2_id) if uid is not None]
            ),
        )
    ).all()
    for notif in old_pending_notifs:
        notif.is_read = True
        session.add(notif)

    short_id = str(match.id)[:4]
    for opp_id in (match.team_b_p1_id, match.team_b_p2_id):
        if opp_id is not None:
            session.add(
                Notification(
                    user_id=opp_id,
                    match_id=match.id,
                    type="pending_confirm",
                    content=f"{current_user.name} 已將待確認比分修正為 {match.score_a}:{match.score_b}（場次 #{short_id}），請您重新核對並確認。",
                    is_read=False,
                )
            )

    session.commit()
    return {"message": "比分已更新", "score_a": match.score_a, "score_b": match.score_b}

@router.post("/api/matches/confirm-batch", summary="批次確認多筆比分並依序結算積分")
def confirm_matches_batch(
    req: MatchBatchConfirmReq,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        result = settle_matches_batch_transaction(
            session=session,
            match_ids=req.match_ids,
            current_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到部分待確認比賽，請重新整理後再試")
    except MatchAlreadySettledError:
        raise HTTPException(status_code=400, detail="部分比賽已確認或已撤回，請重新整理後再試")
    except ConfirmPermissionError:
        raise HTTPException(status_code=403, detail="您沒有權限確認清單中的部分比賽！")

    return {
        "message": f"已完成 {result['confirmed_count']} 場賽果確認，積分結算完畢！",
        **result,
    }


@router.post("/api/matches/{match_id}/confirm", summary="確認比分並結算積分 (觸發 Elo 引擎)")
def confirm_match(match_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    try:
        result = settle_match_transaction(
            session=session,
            match_id=match_id,
            current_user_id=current_user.id,
        )
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    except MatchAlreadySettledError:
        raise HTTPException(status_code=400, detail="此比賽不處於待確認狀態")
    except ConfirmPermissionError:
        raise HTTPException(status_code=403, detail="只有對手可以確認此比分！")

    return {
        "message": "比分已確認，積分結算完畢！",
        **result,
    }


@router.post("/api/matches/{match_id}/dispute", summary="對待確認比賽提出異議（暫停自動結算並通知管理員）")
def dispute_match(
    match_id: UUID,
    req: MatchDisputeReq,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        result = dispute_match_transaction(
            session=session,
            match_id=match_id,
            current_user=current_user,
            reason=req.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    except MatchAlreadySettledError:
        raise HTTPException(status_code=400, detail="此比賽目前已結算或已處於申訴狀態")
    except ConfirmPermissionError:
        raise HTTPException(status_code=403, detail="僅該場參賽選手可以提出異議")

    return {
        "message": "已提交賽果異議並暫停自動結算，系統已通知對手與管理員協助處理。",
        **result,
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
    
    involved_uids = set()
    season_ids = set()
    for m in pending_matches:
        season_ids.add(m.season_id)
        involved_uids.add(m.team_a_p1_id)
        if m.team_a_p2_id: involved_uids.add(m.team_a_p2_id)
        involved_uids.add(m.team_b_p1_id)
        if m.team_b_p2_id: involved_uids.add(m.team_b_p2_id)

    # 批次取得所有相關玩家的當季出賽數（前 5 場 K=32，第 6 場起 K=24）
    season_counts = get_season_match_counts(session, season_ids, list(involved_uids))

    auto_confirm_hours = int(
        get_config_value(
            session,
            "match_auto_confirm_hours",
            str(settings.match_auto_confirm_duration),
        )
    )

    result = []
    for m in pending_matches:
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)
        team_a_p2 = session.get(User, m.team_a_p2_id) if m.team_a_p2_id else None
        team_b_p2 = session.get(User, m.team_b_p2_id) if m.team_b_p2_id else None

        a_won = m.score_a > m.score_b

        # 準備 Elo 計算參數 (Directive 3: Explicit Keyword Alignment)
        deltas = calculate_match_deltas(
            team_winner_p1_mmr=team_a_p1.global_mmr if a_won else team_b_p1.global_mmr,
            team_winner_p2_mmr=(team_a_p2.global_mmr if a_won else team_b_p2.global_mmr) if m.match_type == "doubles" else None,
            team_loser_p1_mmr=team_b_p1.global_mmr if a_won else team_a_p1.global_mmr,
            team_loser_p2_mmr=(team_b_p2.global_mmr if a_won else team_a_p2.global_mmr) if m.match_type == "doubles" else None,
            winner_p1_matches=season_counts.get((m.season_id, m.team_a_p1_id if a_won else m.team_b_p1_id), 0),
            winner_p2_matches=season_counts.get((m.season_id, m.team_a_p2_id if a_won else m.team_b_p2_id), 0) if m.match_type == "doubles" else None,
            loser_p1_matches=season_counts.get((m.season_id, m.team_b_p1_id if a_won else m.team_a_p1_id), 0),
            loser_p2_matches=season_counts.get((m.season_id, m.team_b_p2_id if a_won else m.team_a_p2_id), 0) if m.match_type == "doubles" else None,
            score_winner=max(m.score_a, m.score_b),
            score_loser=min(m.score_a, m.score_b),
            format=m.format
        )
        win_delta = deltas["winner_p1_delta"]
        lose_delta = deltas["loser_p1_delta"]

        player1_data = [{"id": str(team_a_p1.id), "name": team_a_p1.name, "avatar": team_a_p1.avatar_url}]
        opponent_data = [{"id": str(team_b_p1.id), "name": team_b_p1.name, "avatar": team_b_p1.avatar_url}]

        if m.match_type == "doubles":
            if team_a_p2: player1_data.append({"id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url})
            if team_b_p2: opponent_data.append({"id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url})

        expires_at = ensure_utc(m.created_at) + datetime.timedelta(hours=auto_confirm_hours)
        a_change = win_delta if a_won else lose_delta
        b_change = lose_delta if a_won else win_delta

        result.append({
            "id": str(m.id),
            "season_id": m.season_id,
            "challenge_id": str(m.challenge_id) if m.challenge_id else None,
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

def _serialize_player(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "avatar": user.avatar_url,
        "department": user.department,
    }


def _load_users_for_matches(session: Session, matches: list[Match]) -> dict[UUID, User]:
    uids: set[UUID] = set()
    for m in matches:
        uids.add(m.team_a_p1_id)
        uids.add(m.team_b_p1_id)
        if m.team_a_p2_id:
            uids.add(m.team_a_p2_id)
        if m.team_b_p2_id:
            uids.add(m.team_b_p2_id)
    if not uids:
        return {}
    users = session.exec(select(User).where(User.id.in_(list(uids)))).all()
    return {u.id: u for u in users}


@router.get("/api/users/me/matches", summary="取得我的個人完整對戰紀錄")
def get_my_matches(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
    result_filter: str = "all",
    match_type: str = "all",
    season_id: str = "all",
    search: str = ""
):
    statement = select(Match).where(
        or_(
            Match.team_a_p1_id == current_user.id,
            Match.team_a_p2_id == current_user.id,
            Match.team_b_p1_id == current_user.id,
            Match.team_b_p2_id == current_user.id
        )
    )
    if season_id and season_id != "all":
        statement = statement.where(Match.season_id == season_id)
    statement = statement.order_by(Match.created_at.desc())

    all_matches = session.exec(statement).all()
    user_map = _load_users_for_matches(session, all_matches)
    q = search.strip().lower()

    result = []
    for m in all_matches:
        m_type = m.match_type if m.match_type else "singles"
        if match_type in ("singles", "doubles") and m_type != match_type:
            continue

        team_a_p1 = user_map.get(m.team_a_p1_id)
        team_b_p1 = user_map.get(m.team_b_p1_id)
        if not team_a_p1 or not team_b_p1:
            continue

        i_am_team_a = current_user.id in [m.team_a_p1_id, m.team_a_p2_id]
        a_won = m.score_a > m.score_b
        i_won = (i_am_team_a and a_won) or (not i_am_team_a and not a_won)
        my_result = "win" if i_won else "loss"

        if result_filter == "win" and not i_won: continue
        if result_filter == "loss" and i_won: continue

        player1_data = [_serialize_player(team_a_p1)]
        opponent_data = [_serialize_player(team_b_p1)]
        involved_users = [team_a_p1, team_b_p1]

        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = user_map.get(m.team_a_p2_id)
                if team_a_p2:
                    player1_data.append(_serialize_player(team_a_p2))
                    involved_users.append(team_a_p2)
            if m.team_b_p2_id:
                team_b_p2 = user_map.get(m.team_b_p2_id)
                if team_b_p2:
                    opponent_data.append(_serialize_player(team_b_p2))
                    involved_users.append(team_b_p2)

        if q and not any(
            q in (u.name or "").lower() or q in (u.department or "").lower()
            for u in involved_users
        ):
            continue

        delta = m.mmr_exchanged if m.mmr_exchanged else 0
        a_change = round(delta) if a_won else -round(delta)
        b_change = -round(delta) if a_won else round(delta)

        result.append({
            "id": str(m.id),
            "season_id": m.season_id,
            "challenge_id": str(m.challenge_id) if m.challenge_id else None,
            "date": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "created_at": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "score": [m.score_a, m.score_b],
            "result": my_result,
            "status": m.status,
            "type": m_type,
            "tournament": "雙打積分賽" if m.match_type == "doubles" else "單打積分賽",
            "mmrChange": [a_change, b_change],
            "player1": player1_data,
            "opponent": opponent_data,
        })

    total = len(result)
    paginated = result[offset: offset + limit]
    return {"total": total, "matches": paginated, "hasMore": (offset + limit) < total}


@router.get("/api/matches/history", summary="取得全部完整對戰紀錄")
def get_all_matches_history(
    session: Session = Depends(get_session),
    limit: int = 50,
    offset: int = 0,
    status_filter: str = "all",
    match_type: str = "all",
    season_id: str = "all",
    search: str = ""
):
    statement = select(Match)
    if season_id and season_id != "all":
        statement = statement.where(Match.season_id == season_id)
    statement = statement.order_by(Match.created_at.desc())
    all_matches = session.exec(statement).all()
    user_map = _load_users_for_matches(session, all_matches)
    q = search.strip().lower()

    result = []
    for m in all_matches:
        m_type = m.match_type if m.match_type else "singles"
        if match_type in ("singles", "doubles") and m_type != match_type:
            continue

        if status_filter == "confirmed" and m.status not in ("confirmed", "completed"):
            continue
        if status_filter == "pending" and m.status != "pending":
            continue
        if status_filter == "disputed" and m.status != "disputed":
            continue

        team_a_p1 = user_map.get(m.team_a_p1_id)
        team_b_p1 = user_map.get(m.team_b_p1_id)
        if not team_a_p1 or not team_b_p1:
            continue

        player1_data = [_serialize_player(team_a_p1)]
        opponent_data = [_serialize_player(team_b_p1)]
        involved_users = [team_a_p1, team_b_p1]

        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = user_map.get(m.team_a_p2_id)
                if team_a_p2:
                    player1_data.append(_serialize_player(team_a_p2))
                    involved_users.append(team_a_p2)
            if m.team_b_p2_id:
                team_b_p2 = user_map.get(m.team_b_p2_id)
                if team_b_p2:
                    opponent_data.append(_serialize_player(team_b_p2))
                    involved_users.append(team_b_p2)

        if q and not any(
            q in (u.name or "").lower() or q in (u.department or "").lower()
            for u in involved_users
        ):
            continue

        a_won = m.score_a > m.score_b
        delta = m.mmr_exchanged if m.mmr_exchanged else 0
        a_change = round(delta) if a_won else -round(delta)
        b_change = -round(delta) if a_won else round(delta)

        result.append({
            "id": str(m.id),
            "season_id": m.season_id,
            "challenge_id": str(m.challenge_id) if m.challenge_id else None,
            "date": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "created_at": ensure_utc(m.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "score": [m.score_a, m.score_b],
            "result": "win" if a_won else "loss",
            "status": m.status,
            "type": m_type,
            "tournament": "雙打積分賽" if m.match_type == "doubles" else "單打積分賽",
            "mmrChange": [a_change, b_change],
            "player1": player1_data,
            "opponent": opponent_data,
        })

    total = len(result)
    paginated = result[offset: offset + limit]
    return {"total": total, "matches": paginated, "hasMore": (offset + limit) < total}


@router.get("/api/matches/recent", summary="取得最近的比賽紀錄 (Recent Feed)")
def get_recent_matches(limit: int = 8, session: Session = Depends(get_session)):
    statement = select(Match).order_by(Match.created_at.desc()).limit(limit)
    recent_matches = session.exec(statement).all()
    user_map = _load_users_for_matches(session, recent_matches)

    # 批次計算 Pending 場次的當季出賽數（前 5 場 K=32，第 6 場起 K=24）
    involved_uids = set()
    season_ids = set()
    for m in recent_matches:
        if m.status == "pending":
            season_ids.add(m.season_id)
            involved_uids.add(m.team_a_p1_id)
            if m.team_a_p2_id: involved_uids.add(m.team_a_p2_id)
            involved_uids.add(m.team_b_p1_id)
            if m.team_b_p2_id: involved_uids.add(m.team_b_p2_id)
    season_counts = get_season_match_counts(session, season_ids, list(involved_uids))

    result = []
    for m in recent_matches:
        team_a_p1 = user_map.get(m.team_a_p1_id)
        team_b_p1 = user_map.get(m.team_b_p1_id)

        if not team_a_p1 or not team_b_p1: continue

        player1_data = [_serialize_player(team_a_p1)]
        opponent_data = [_serialize_player(team_b_p1)]

        team_a_p2 = None
        team_b_p2 = None
        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = user_map.get(m.team_a_p2_id)
                if team_a_p2: player1_data.append(_serialize_player(team_a_p2))
            if m.team_b_p2_id:
                team_b_p2 = user_map.get(m.team_b_p2_id)
                if team_b_p2: opponent_data.append(_serialize_player(team_b_p2))

        is_a_win = m.score_a > m.score_b

        # 🟢 如果比賽已結算，直接使用 DB 存好的積分變動 (m.mmr_exchanged)
        if m.status in ["confirmed", "completed"] and m.mmr_exchanged is not None:
            delta = m.mmr_exchanged
            mmr_change = [delta, -delta] if is_a_win else [-delta, delta]
        else:
            # 🟡 如果是 Pending，則依當季出賽數與選手獨立 K 值動態計算預覽分數
            deltas = calculate_match_deltas(
                team_winner_p1_mmr=team_a_p1.global_mmr if is_a_win else team_b_p1.global_mmr,
                team_winner_p2_mmr=(team_a_p2.global_mmr if is_a_win else team_b_p2.global_mmr) if m.match_type == "doubles" else None,
                team_loser_p1_mmr=team_b_p1.global_mmr if is_a_win else team_a_p1.global_mmr,
                team_loser_p2_mmr=(team_b_p2.global_mmr if is_a_win else team_a_p2.global_mmr) if m.match_type == "doubles" else None,
                winner_p1_matches=season_counts.get((m.season_id, m.team_a_p1_id if is_a_win else m.team_b_p1_id), 0),
                winner_p2_matches=season_counts.get((m.season_id, m.team_a_p2_id if is_a_win else m.team_b_p2_id), 0) if m.match_type == "doubles" else None,
                loser_p1_matches=season_counts.get((m.season_id, m.team_b_p1_id if is_a_win else m.team_a_p1_id), 0),
                loser_p2_matches=season_counts.get((m.season_id, m.team_b_p2_id if is_a_win else m.team_a_p2_id), 0) if m.match_type == "doubles" else None,
                score_winner=max(m.score_a, m.score_b),
                score_loser=min(m.score_a, m.score_b),
                format=m.format
            )
            win_delta = deltas["winner_p1_delta"]
            lose_delta = deltas["loser_p1_delta"]
            mmr_change = [win_delta, lose_delta] if is_a_win else [lose_delta, win_delta]

        result.append({
            "id": str(m.id),
            "season_id": m.season_id,
            "challenge_id": str(m.challenge_id) if m.challenge_id else None,
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