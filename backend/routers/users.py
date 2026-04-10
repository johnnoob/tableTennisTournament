from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from database import get_session
from services.auth_jwt import get_current_user # 🌟 引入警衛
from models import User, Season, SeasonRecord, PlayerStatHistory, MatchParticipation
from uuid import UUID

router = APIRouter(tags=["Users"])

@router.get("/api/users", summary="取得機關所有同仁名單")
def get_all_users(session: Session = Depends(get_session)):
    # 📝 從資料庫撈出所有的 User
    statement = select(User)
    users = session.exec(statement).all()
    
    # 為了版面乾淨，我們只回傳 ID、姓名和處室
    return [
        {
            "name": user.name,
            "department": user.department,
            "id": user.id,
            "mmr": user.global_mmr
        }
        for user in users
    ]
# ==========================================
#獲取當前登入者的基本資料 
# ==========================================
@router.get("/api/users/me", summary="獲取當前登入者的個人資料")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "department": current_user.department,
        "avatar": current_user.avatar_url,
        "mmr": current_user.global_mmr,
        "role": current_user.role,
        "dominant_hand": current_user.dominant_hand,
        "rubber_forehand": current_user.rubber_forehand,
        "rubber_backhand": current_user.rubber_backhand,
        "gender": current_user.gender,
    }

# ==========================================
# 更新當前登入者的個人資料 (PATCH)
# ==========================================
@router.patch("/api/users/me", summary="更新當前登入者的個人資料")
def update_my_profile(
    req: dict,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    EDITABLE_FIELDS = {"name", "department", "gender", "dominant_hand", "rubber_forehand", "rubber_backhand"}

    for field, value in req.items():
        if field in EDITABLE_FIELDS:
            setattr(current_user, field, value if value else None)

    if not current_user.name or not current_user.name.strip():
        raise HTTPException(status_code=422, detail="顯示姓名不得為空")

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "department": current_user.department,
        "avatar": current_user.avatar_url,
        "mmr": current_user.global_mmr,
        "role": current_user.role,
        "dominant_hand": current_user.dominant_hand,
        "rubber_forehand": current_user.rubber_forehand,
        "rubber_backhand": current_user.rubber_backhand,
        "gender": current_user.gender,
    }

from services.season_service import get_current_season

@router.get("/api/users/me/stats", summary="獲取當前登入者的戰力與歷史數據")
def get_my_stats(
    interval: str = "recent", # 🌟 新增 interval 參數 (接收: recent, hour, day, month, quarter)
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    # 🌟 使用與排行榜一致的自動賽季引擎
    active_season = get_current_season(session)
    
    rank, win_rate, trend = "-", "0%", "new"
    lp, matches_played = current_user.global_mmr, 0
    my_record = None  # 🔧 Fix: ensure my_record is always defined

    if active_season:
        # (這裡計算 rank, win_rate, trend 的邏輯跟原本一樣，保持不變)
        my_record = session.exec(select(SeasonRecord).where(
            SeasonRecord.user_id == current_user.id, SeasonRecord.season_id == active_season.id
        )).first()

        if my_record:
            matches_played = my_record.matches_played
            if matches_played > 0:
                win_rate = f"{(my_record.wins / matches_played) * 100:.1f}%"

            higher_scores_count = session.exec(select(func.count(User.id)).where(
                User.role != "guest", User.global_mmr > current_user.global_mmr
            )).one()
            rank = higher_scores_count + 1 

            if my_record.previous_rank:
                if rank < my_record.previous_rank: trend = "up"
                elif rank > my_record.previous_rank: trend = "down"
                else: trend = "same"

    # ==========================================
    # 🌟 核心修改：歷史軌跡的時間維度分組
    # ==========================================
    
    # 1. 抓出該玩家「所有」的歷史紀錄 (依照時間舊到新排序)
    history = session.exec(
        select(PlayerStatHistory)
        .where(PlayerStatHistory.user_id == current_user.id)
        .order_by(PlayerStatHistory.recorded_at.asc())
    ).all()

    chart_data = []
    pts_change = 0

    if not history:
        chart_data.append({"name": "Start", "rating": round(current_user.global_mmr)})
    else:
        if interval == "recent":
            # 預設：只取最近 10 場比賽
            for h in history[-10:]:
                chart_data.append({
                    "name": h.recorded_at.strftime("%m/%d %H:%M"), 
                    "rating": round(h.mmr)
                })
        else:
            # 依據選擇的維度進行分組 (Grouping)
            grouped_data = {}
            for h in history:
                if interval == "hour":
                    key = h.recorded_at.strftime("%m/%d %H:00") # 分組到小時
                elif interval == "day":
                    key = h.recorded_at.strftime("%m/%d")       # 分組到天
                elif interval == "month":
                    key = h.recorded_at.strftime("%Y/%m")       # 分組到月
                elif interval == "quarter":
                    q = (h.recorded_at.month - 1) // 3 + 1
                    key = f"{h.recorded_at.year}-Q{q}"          # 分組到季

                # 🌟 Python 字典特性：相同的 key 如果重複寫入，會蓋掉前面的。
                # 這剛好符合我們要的：取該時段的「最終積分」！
                grouped_data[key] = round(h.mmr)
            
            # 將字典轉回陣列給前端
            for k, v in grouped_data.items():
                chart_data.append({"name": k, "rating": v})

            # 限制顯示數量，確保圖表好閱讀
            if interval == "hour": chart_data = chart_data[-24:]     # 顯示最近 24 小時
            elif interval == "day": chart_data = chart_data[-30:]    # 顯示最近 30 天
            elif interval == "month": chart_data = chart_data[-12:]  # 顯示最近 12 個月
            elif interval == "quarter": chart_data = chart_data[-10:] # 顯示最近 10 季

        # 2. 計算 PTS 變化 (不論圖表怎麼顯示，這裡的變化是指「最新一場」跟「前一場」的差異)
        if len(history) >= 2:
            pts_change = round(history[-1].mmr - history[-2].mmr)
        else:
            pts_change = round(history[-1].mmr - 1200) # 若只有一場，跟初始分 1200 比

    return {
        "rank": rank, "win_rate": win_rate, "trend": trend, 
        "global_mmr": round(current_user.global_mmr),
        "matches_played": matches_played, 
        "wins": my_record.wins if my_record else 0,
        "losses": (my_record.matches_played - my_record.wins) if my_record else 0,
        "chart_data": chart_data, "pts_change": pts_change
    }

# ==========================================
# 4. 取得天敵與手下敗將 (Nemesis & Minions)
# ==========================================
@router.get("/api/users/me/rivals", summary="取得天敵與提款機資料")
def get_my_rivals(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 1. 🔍 找到我參與過的所有比賽紀錄
    my_participations = session.exec(
        select(MatchParticipation).where(MatchParticipation.user_id == current_user.id)
    ).all()
    
    if not my_participations:
        return {"nemesis": [], "minions": []}

    # 紀錄對手數據字典： opponent_id -> {matches, wins_against, lp_exchanged, user_id}
    rivals_stats = {}
    
    for p in my_participations:
        # ⚔️ 找到這場比賽的對手 (同一場比賽，但是不同陣營)
        opponents = session.exec(
            select(MatchParticipation).where(
                MatchParticipation.match_id == p.match_id,
                MatchParticipation.team != p.team
            )
        ).all()
        
        for opp in opponents:
            if opp.user_id not in rivals_stats:
                rivals_stats[opp.user_id] = {"matches": 0, "wins_against": 0, "rating_exchanged": 0, "user_id": opp.user_id}
            
            # 統計對陣次數與勝場
            rivals_stats[opp.user_id]["matches"] += 1
            if p.is_winner:
                rivals_stats[opp.user_id]["wins_against"] += 1
                
            # 📈 累計從這個對手身上拿走 (或輸掉) 的積分總和 (使用 MMR)
            rivals_stats[opp.user_id]["rating_exchanged"] += p.mmr_delta
            
    # 2. 📊 整理與排序資料
    rivals_list = list(rivals_stats.values())
    # 依照積分淨勝值排序：負最多 (掉最多分) 在前面代表天敵，正最多在後面代表提款機
    sorted_rivals = sorted(rivals_list, key=lambda x: x["rating_exchanged"])
    
    # 格式化輸出用的閉包函式
    def format_rival(stats):
        if not stats: return None
        opp_user = session.get(User, stats["user_id"])
        win_rate = int((stats["wins_against"] / stats["matches"]) * 100)
        return {
            "id": str(opp_user.id),
            "name": opp_user.name,
            "avatar": opp_user.avatar_url,
            "winRate": win_rate,
            "matches": stats["matches"],
            "pointsExchanged": round(stats["rating_exchanged"])
        }

    nemesis_list = []
    minions_list = []
    
    if sorted_rivals:
        # 👿 天敵：讓我掉最多分的前兩名 (只取最前面的)
        nemesis_candidates = sorted_rivals[:2]
        for n in nemesis_candidates:
            nemesis_list.append(format_rival(n))
            
        # 👑 提款機：讓我賺最多分的前兩名 (陣列反轉，且不能跟天敵重複)
        minions_candidates = reversed(sorted_rivals)
        for m in minions_candidates:
            if len(minions_list) < 2 and m["user_id"] not in [n["user_id"] for n in nemesis_candidates]:
                minions_list.append(format_rival(m))

    return {
        "nemesis": nemesis_list,
        "minions": minions_list
    }

# ==========================================
# 4.5 取得黃金搭檔與豬隊友 (Golden & Worst Partners)
# ==========================================
@router.get("/api/users/me/partners", summary="取得黃金搭檔與豬隊友資料")
def get_my_partners(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 1. 🔍 找到我參與過的所有比賽紀錄
    my_participations = session.exec(
        select(MatchParticipation).where(MatchParticipation.user_id == current_user.id)
    ).all()
    
    if not my_participations:
        return {"golden_partners": [], "worst_partners": []}

    partners_stats = {}
    
    for p in my_participations:
        # 🤝 找到這場比賽的搭檔 (同一場比賽，且同一陣營，但不是我自己)
        teammates = session.exec(
            select(MatchParticipation).where(
                MatchParticipation.match_id == p.match_id,
                MatchParticipation.team == p.team,
                MatchParticipation.user_id != p.user_id
            )
        ).all()
        
        for tm in teammates:
            if tm.user_id not in partners_stats:
                partners_stats[tm.user_id] = {"matches": 0, "wins": 0, "rating_exchanged": 0, "user_id": tm.user_id}
            
            partners_stats[tm.user_id]["matches"] += 1
            if p.is_winner:
                partners_stats[tm.user_id]["wins"] += 1
                
            # 搭檔時，自己獲得或失去的積分總和 (使用 user 本人的 mmr_delta)
            partners_stats[tm.user_id]["rating_exchanged"] += p.mmr_delta
            
    # 2. 📊 整理與排序資料
    partners_list = list(partners_stats.values())
    sorted_partners = sorted(partners_list, key=lambda x: x["rating_exchanged"], reverse=True)
    
    def format_partner(stats):
        if not stats: return None
        tm_user = session.get(User, stats["user_id"])
        win_rate = int((stats["wins"] / stats["matches"]) * 100)
        return {
            "id": str(tm_user.id),
            "name": tm_user.name,
            "avatar": tm_user.avatar_url,
            "winRate": win_rate,
            "matches": stats["matches"],
            "pointsExchanged": round(stats["rating_exchanged"])
        }

    golden_list = []
    worst_list = []
    
    if sorted_partners:
        # 🌟 黃金搭檔：讓我賺最多分的前兩名 (rating_exchanged >= 0)
        for g in sorted_partners:
            if len(golden_list) >= 2:
                break
            if g["rating_exchanged"] >= 0:
                golden_list.append(format_partner(g))
            
        # 🐷 豬隊友：讓我掉最多分的前兩名 (rating_exchanged < 0)
        # 只排除真正進入 golden_list 的人，不排除所有 sorted_partners[:2]
        golden_ids = {g["id"] for g in golden_list}
        for w in reversed(sorted_partners):
            if len(worst_list) >= 2:
                break
            if w["rating_exchanged"] < 0 and str(w["user_id"]) not in golden_ids:
                worst_list.append(format_partner(w))

    return {
        "golden_partners": golden_list,
        "worst_partners": worst_list
    }

# ==========================================
# 5. 取得特定玩家的全域資料卡 (Global Profile)
# ==========================================
@router.get("/api/users/{target_id}/profile", summary="取得特定玩家的全局資料卡")
def get_user_profile(target_id: UUID, session: Session = Depends(get_session)):
    # 1. 基本資料
    user = session.get(User, target_id)
    if not user:
        raise HTTPException(status_code=404, detail="找不到該玩家")
        
    # 🌟 2. 📊 生涯勝率與出賽數 (改用最精準的 MatchParticipation 來計算！)
    # 只要有確認過比賽，這裡絕對會有紀錄，不可能出錯
    participations = session.exec(
        select(MatchParticipation).where(MatchParticipation.user_id == user.id)
    ).all()
    
    total_matches = len(participations)
    total_wins = sum(1 for p in participations if p.is_winner)
    total_losses = total_matches - total_wins
    # 防呆：避免除以 0
    win_rate = int((total_wins / total_matches) * 100) if total_matches > 0 else 0
    
    # 3. 📈 歷史圖表資料
    history = session.exec(
        select(PlayerStatHistory)
        .where(PlayerStatHistory.user_id == user.id)
        .order_by(PlayerStatHistory.recorded_at.asc())
    ).all()
    
    chart_data = []
    if not history:
        chart_data.append({"name": "Start", "rating": round(user.global_mmr)})
    else:
        for h in history[-15:]: # 顯示最近 15 筆軌跡
            chart_data.append({
                "name": h.recorded_at.strftime("%m/%d %H:%M"),
                "rating": round(h.mmr)
            })
            
    # 4. 👿 宿命天敵 (重複利用上面已經撈出來的 participations)
    rivals_stats = {}
    partners_stats = {}

    for p in participations:
        # 計算天敵
        opponents = session.exec(select(MatchParticipation).where(
            MatchParticipation.match_id == p.match_id, 
            MatchParticipation.team != p.team
        )).all()
        for opp in opponents:
            if opp.user_id not in rivals_stats:
                rivals_stats[opp.user_id] = {"matches": 0, "wins": 0, "rating_exchanged": 0, "user_id": opp.user_id}
            rivals_stats[opp.user_id]["matches"] += 1
            if p.is_winner:
                rivals_stats[opp.user_id]["wins"] += 1
            rivals_stats[opp.user_id]["rating_exchanged"] += p.mmr_delta

        # 計算搭檔
        teammates = session.exec(select(MatchParticipation).where(
            MatchParticipation.match_id == p.match_id, 
            MatchParticipation.team == p.team,
            MatchParticipation.user_id != p.user_id
        )).all()
        for tm in teammates:
            if tm.user_id not in partners_stats:
                partners_stats[tm.user_id] = {"matches": 0, "wins": 0, "rating_exchanged": 0, "user_id": tm.user_id}
            partners_stats[tm.user_id]["matches"] += 1
            if p.is_winner:
                partners_stats[tm.user_id]["wins"] += 1
            partners_stats[tm.user_id]["rating_exchanged"] += p.mmr_delta
            
    sorted_rivals = sorted(rivals_stats.values(), key=lambda x: x["rating_exchanged"])
    nemesis_list = []
    for m in sorted_rivals[:3]: # 取前三名扣最多分的
        opp_user = session.get(User, m["user_id"])
        nemesis_list.append({
            "id": str(opp_user.id),
            "name": opp_user.name,
            "avatar": opp_user.avatar_url,
            "winRate": int((m["wins"]/m["matches"])*100) if m["matches"] > 0 else 0
        })

    sorted_partners = sorted(partners_stats.values(), key=lambda x: x["rating_exchanged"], reverse=True)
    golden_list = []
    for g in sorted_partners[:3]: # 取前三名加最多分的
        if g["rating_exchanged"] >= 0:
            tm_user = session.get(User, g["user_id"])
            golden_list.append({
                "id": str(tm_user.id),
                "name": tm_user.name,
                "avatar": tm_user.avatar_url,
                "winRate": int((g["wins"]/g["matches"])*100) if g["matches"] > 0 else 0
            })

    # 5. 📦 打包成前端需要的格式
    return {
        "id": str(user.id),
        "name": user.name,
        "department": user.department,
        "avatar": user.avatar_url,
        "rating": round(user.global_mmr),
        "stats": {
            "winRate": win_rate,     # 🌟 現在會給出真實的勝率了
            "wins": total_wins,      # 🌟 真實勝場
            "losses": total_losses,  # 🌟 真實敗場
        },
        "racketConfig": {
            "forehand": user.rubber_forehand or "未設定",
            "backhand": user.rubber_backhand or "未設定",
        },
        "goldenPartner": golden_list,
        "nemesis": nemesis_list,
        "chart_data": chart_data
    }