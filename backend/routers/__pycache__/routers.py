from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from uuid import UUID

from database import get_session
from models import Match, Season, Notification, User
from schemas import MatchCreateReq

# 🌟 匯入我們的 Elo 引擎
from services.elo_engine import get_team_mmr, calculate_elo_delta

router = APIRouter(tags=["Matches"])

@router.post("/api/matches", summary="發起報分 (進入 Pending 狀態)")
def report_match(req: MatchCreateReq, session: Session = Depends(get_session)):
    # 1. 🔍 尋找當前進行中的賽季
    statement = select(Season).where(Season.status == "active")
    current_season = session.exec(statement).first()
    
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
        status="pending" # 關鍵：此時還沒計算 Elo！
    )
    session.add(new_match)
    session.flush() # 將 Match 推入資料庫以取得自動生成的 ID，但先不 commit

    # 3. 🔔 建立通知發送給對手 (Team B 的玩家 1)
    # 為了在通知中顯示名字，我們去查一下報分者的名字
    reporter = session.get(User, req.reported_by)
    reporter_name = reporter.name if reporter else "某位同仁"

    notification = Notification(
        user_id=req.team_b_p1_id, # 通知接收者是對手
        match_id=new_match.id,
        type="pending_confirm",
        content=f"{reporter_name} 剛剛送出了一筆 {req.score_a}:{req.score_b} 的比分，請您確認。",
        is_read=False
    )
    session.add(notification)

    # 如果是雙打，也要通知對手的隊友
    if req.team_b_p2_id:
        notification_p2 = Notification(
            user_id=req.team_b_p2_id,
            match_id=new_match.id,
            type="pending_confirm",
            content=f"{reporter_name} 剛剛送出了一筆雙打比分，請您確認。",
            is_read=False
        )
        session.add(notification_p2)

    # 4. 💾 交易確認 (一次性將 Match 和 Notification 寫入資料庫)
    session.commit()
    session.refresh(new_match)

    return {
        "message": "報分已送出，等待對手確認中！",
        "match_id": new_match.id
    }