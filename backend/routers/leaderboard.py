from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import Season, SeasonRecord, User, Match, MatchParticipation

from services.season_service import get_current_season

router = APIRouter(tags=["Leaderboard"])

@router.get("/api/leaderboard", summary="取得本季排行榜與動能指標")
def get_leaderboard(season_id: Optional[str] = None, session: Session = Depends(get_session)):
    
    # 🌟 1. 取得指定或目前的賽季
    if season_id:
        season = session.get(Season, season_id)
        if not season:
            raise HTTPException(status_code=404, detail="找不到指定的賽季")
    else:
        season = get_current_season(session)
        
    if not season:
        return {"season_id": None, "season_name": "休賽季", "leaderboard": []}


    # 🌟 2. 撈取所有玩家與他們在本季的戰績
    # 即使本季才剛開始 (沒人打過比賽)，也會依照他們的隱藏積分 (global_mmr) 來進行季前排名預測
    users = session.exec(select(User).where(User.role != "guest")).all()
    records = session.exec(select(SeasonRecord).where(SeasonRecord.season_id == season.id)).all()
    
    # 建立 user_id -> SeasonRecord 的映射
    record_map = {r.user_id: r for r in records}
    
    combined_data = []
    for user in users:
        record = record_map.get(user.id)
        if record:
            season_lp = record.season_lp
            matches_played = record.matches_played
            wins = record.wins
            previous_rank = record.previous_rank
        else:
            # 如果還沒打過本季，全部從固定起始積分 1200 分開始
            season_lp = 1200
            matches_played = 0
            wins = 0
            previous_rank = None
            
        combined_data.append({
            "user": user,
            "season_lp": season_lp,
            "matches_played": matches_played,
            "wins": wins,
            "previous_rank": previous_rank
        })
        
    # 依照 season_lp 降序排列
    combined_data.sort(key=lambda x: x["season_lp"], reverse=True)

    # 📈 3. 計算排名、勝率與動能趨勢
    leaderboard_data = []
    current_rank = 1

    for data in combined_data:
        user = data["user"]
        matches_played = data["matches_played"]
        wins = data["wins"]
        previous_rank = data["previous_rank"]
        season_lp = data["season_lp"]
        
        # A. 計算勝率 (防呆：避免除以零的錯誤)
        if matches_played > 0:
            win_rate_val = (wins / matches_played) * 100
        else:
            win_rate_val = 0.0
        win_rate_str = f"{win_rate_val:.1f}%" # 格式化為小數點後一位
        
        # B. 🔼 計算動能指標 (Trend) - 以符號字串形式返回 (例如: +2, -1, 0)
        trend_str = "0"
        if previous_rank is not None:
            if current_rank < previous_rank:
                # 名次上升
                trend_str = f"+{previous_rank - current_rank}"
            elif current_rank > previous_rank:
                # 名次下降
                trend_str = f"-{current_rank - previous_rank}"
        
        # C. 🟢 近期狀態 (Recent Form) - 撈取最近 5 場已確認的比賽
        recent_matches = session.exec(
            select(MatchParticipation)
            .join(Match, MatchParticipation.match_id == Match.id)
            .where(MatchParticipation.user_id == user.id)
            .where(Match.status == "confirmed")
            .where(Match.season_id == season.id)
            .order_by(Match.created_at.desc())
            .limit(5)
        ).all()
        
        # 轉換為 ["W", "L", "W", ...] 格式
        # 這裡我們按時間由新到舊排列，如果要前端左到右是新到舊，就這樣即可
        recent_form = ["W" if p.is_winner else "L" for p in recent_matches]

        # D. 打包資料給前端
        leaderboard_data.append({
            "rank": current_rank,
            "player_id": str(user.id),
            "player_name": user.name,
            "department": user.department,
            "avatar_url": user.avatar_url,
            "season_lp": round(season_lp),
            "matches_played": matches_played,
            "global_mmr": round(user.global_mmr),
            "wins": wins,
            "losses": matches_played - wins,
            "win_rate": win_rate_str,
            "trend": trend_str,
            "recent_form": recent_form
        })
        
        current_rank += 1

    return {
        "season_id": season.id,
        "season_name": season.name,
        "leaderboard": leaderboard_data
    }