from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import Season, SeasonRecord, User

from services.season_service import get_or_create_current_season

router = APIRouter(tags=["Leaderboard"])

@router.get("/api/leaderboard", summary="取得本季排行榜與動能指標")
def get_leaderboard(season_id: Optional[str] = None, session: Session = Depends(get_session)):
    
    # 🌟 2. 結合您的邏輯與自動引擎
    if season_id:
        season = session.get(Season, season_id)
        if not season:
            raise HTTPException(status_code=404, detail="找不到指定的賽季")
    else:
        # 如果沒有指定賽季，就呼叫我們的 10 分鐘自動推進引擎！
        season = get_or_create_current_season(session)

    # 📝 撈取該賽季所有有戰績的玩家，並依照 season_lp (賽季積分) 降序排列
    statement = (
        select(SeasonRecord, User)
        .join(User)
        .where(SeasonRecord.season_id == season.id)
        .order_by(SeasonRecord.season_lp.desc())
    )
    results = session.exec(statement).all()

    # 📈 計算排名、勝率與動能趨勢 (🌟 以下完全保留您原本完美的邏輯！)
    leaderboard_data = []
    current_rank = 1

    for record, user in results:
        # A. 計算勝率 (防呆：避免除以零的錯誤)
        if record.matches_played > 0:
            win_rate_val = (record.wins / record.matches_played) * 100
        else:
            win_rate_val = 0.0
        win_rate_str = f"{win_rate_val:.1f}%" # 格式化為小數點後一位，例如 "75.0%"

        # B. 🔼 計算動能指標 (Trend)
        trend = "same"
        rank_change = 0

        if record.previous_rank is None:
            trend = "new"  # 新進榜
        elif current_rank < record.previous_rank:
            trend = "up"   # 名次上升 (數字變小代表進步)
            rank_change = record.previous_rank - current_rank
        elif current_rank > record.previous_rank:
            trend = "down" # 名次下降
            rank_change = current_rank - record.previous_rank

        # C. 打包資料給前端
        leaderboard_data.append({
            "rank": current_rank,
            "player_id": str(user.id),  # 🌟 轉成字串以防 JSON 解析報錯
            "player_name": user.name,
            "department": user.department,
            "avatar_url": user.avatar_url,
            "season_lp": round(record.season_lp, 1),
            "matches_played": record.matches_played,
            "wins": record.wins,
            "win_rate": win_rate_str,
            "trend": trend,              # 前端透過 'up', 'down', 'same', 'new' 來決定顯示綠色或紅色
            "rank_change": rank_change   # 前端顯示：▲ 2 或 ▼ 1
        })
        
        current_rank += 1

    return {
        "season_id": season.id,
        "season_name": season.name,
        "leaderboard": leaderboard_data
    }