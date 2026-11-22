from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func, or_
from database import get_session
from services.auth_jwt import get_current_user # 🌟 引入警衛
from models import User, Season, SeasonRecord, PlayerStatHistory, MatchParticipation, Match, MatchPreset, Notification, utc_now
from schemas import MatchPresetCreate, MatchPresetUpdate
from services.season_service import get_current_season, ensure_utc
from uuid import UUID

MAX_MATCH_PRESETS = 8
_preset_table_ready = False

router = APIRouter(tags=["Users"])

@router.get("/api/users", summary="取得機關所有同仁名單")
def get_all_users(session: Session = Depends(get_session)):
    # 📝 從資料庫撈出所有活躍非訪客的 User
    statement = select(User).where(User.is_active == True, User.role != "guest")
    users = session.exec(statement).all()
    
    # 為了版面乾淨，我們只回傳 ID、姓名和處室
    return [
        {
            "name": user.name,
            "department": user.department,
            "id": user.id,
            "mmr": user.global_mmr,
            "avatar": user.avatar_url,
        }
        for user in users
    ]
# ==========================================
# 獲取與更新當前登入者的個人資料
# ==========================================
def _serialize_my_profile(user: User) -> dict:
    google_linked = bool(user.google_id or (user.auth_provider == "google" and user.oauth_id))
    line_linked = bool(user.line_user_id or (user.auth_provider == "line" and user.oauth_id))
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "department": user.department,
        "avatar": user.avatar_url,
        "mmr": user.global_mmr,
        "role": user.role,
        "auth_provider": user.auth_provider,
        "google_linked": google_linked,
        "line_linked": line_linked,
        "line_display_name": user.line_display_name,
        "dominant_hand": user.dominant_hand,
        "rubber_forehand": user.rubber_forehand,
        "rubber_backhand": user.rubber_backhand,
        "gender": user.gender,
    }


@router.get("/api/users/me", summary="獲取當前登入者的個人資料")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return _serialize_my_profile(current_user)


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

    return _serialize_my_profile(current_user)

from services.season_service import get_current_season

@router.get("/api/users/me/stats", summary="獲取當前登入者的戰力與歷史數據")
def get_my_stats(
    interval: str = "recent",
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    active_season = get_current_season(session)

    rank: int | str = "-"
    win_rate = "0%"
    trend = "new"
    matches_played = 0
    wins = 0
    losses = 0
    my_record = None

    if active_season:
        my_record = session.exec(select(SeasonRecord).where(
            SeasonRecord.user_id == current_user.id, SeasonRecord.season_id == active_season.id
        )).first()

        if my_record and my_record.matches_played > 0:
            matches_played = my_record.matches_played
            wins = my_record.wins
            losses = max(0, matches_played - wins)
            win_rate = f"{(wins / matches_played) * 100:.1f}%"

            statement = select(func.count(User.id)).join(
                SeasonRecord, User.id == SeasonRecord.user_id
            ).where(
                User.role != "guest",
                SeasonRecord.season_id == active_season.id,
                SeasonRecord.matches_played > 0,
                User.global_mmr > current_user.global_mmr
            )
            higher_scores_count = session.exec(statement).one()
            rank = higher_scores_count + 1

            if my_record.previous_rank and isinstance(rank, int):
                if rank < my_record.previous_rank: trend = "up"
                elif rank > my_record.previous_rank: trend = "down"
                else: trend = "same"

    # 讀取玩家參與的實際對戰紀錄（供 SeasonRecord 為 0 時保底補齊，及計算連勝/近5場走勢）
    user_matches = session.exec(
        select(Match)
        .where(
            or_(
                Match.team_a_p1_id == current_user.id,
                Match.team_a_p2_id == current_user.id,
                Match.team_b_p1_id == current_user.id,
                Match.team_b_p2_id == current_user.id,
            )
        )
        .order_by(Match.created_at.desc())
    ).all()

    settled_matches = [m for m in user_matches if m.status in ("confirmed", "completed")]
    counted_matches = settled_matches if settled_matches else [
        m for m in user_matches if m.status != "disputed"
    ]

    match_outcomes = []
    for m in counted_matches:
        in_a = current_user.id in (m.team_a_p1_id, m.team_a_p2_id)
        a_won = m.score_a > m.score_b
        i_won = (in_a and a_won) or (not in_a and not a_won)
        delta = round(m.mmr_exchanged or 0)
        my_delta = delta if i_won else -delta
        match_outcomes.append({"won": i_won, "delta": my_delta})

    if matches_played == 0 and len(match_outcomes) > 0:
        matches_played = len(match_outcomes)
        wins = sum(1 for item in match_outcomes if item["won"])
        losses = matches_played - wins
        win_rate = f"{(wins / matches_played) * 100:.1f}%"

    if rank == "-" and (matches_played > 0 or round(current_user.global_mmr) != 1000):
        higher_count = session.exec(
            select(func.count(User.id)).where(
                User.role != "guest",
                User.id != current_user.id,
                User.global_mmr > current_user.global_mmr,
            )
        ).one()
        rank = higher_count + 1

    # 近 5 場走勢（左舊右新）與連勝／連敗數
    recent_5 = list(reversed(match_outcomes[:5]))
    recent_form = ["W" if item["won"] else "L" for item in recent_5]
    recent_5_delta = round(sum(item["delta"] for item in recent_5))

    current_streak = 0
    if match_outcomes:
        first_won = match_outcomes[0]["won"]
        for item in match_outcomes:
            if item["won"] == first_won:
                current_streak += 1
            else:
                break
        if not first_won:
            current_streak = -current_streak

    # ==========================================
    # 🌟 核心修改：歷史軌跡的時間維度分組
    # ==========================================
    history = session.exec(
        select(PlayerStatHistory)
        .where(PlayerStatHistory.user_id == current_user.id)
        .order_by(PlayerStatHistory.recorded_at.asc())
    ).all()

    chart_data = []
    pts_change = 0

    if not history:
        chart_data.append({"name": "Start", "rating": round(current_user.global_mmr)})
        if round(current_user.global_mmr) != 1000:
            pts_change = round(current_user.global_mmr - 1000)
    else:
        if interval == "recent":
            for h in history[-10:]:
                chart_data.append({
                    "name": h.recorded_at.strftime("%m/%d %H:%M"),
                    "rating": round(h.mmr)
                })
        else:
            grouped_data = {}
            for h in history:
                if interval == "hour":
                    key = h.recorded_at.strftime("%m/%d %H:00")
                elif interval == "day":
                    key = h.recorded_at.strftime("%m/%d")
                elif interval == "month":
                    key = h.recorded_at.strftime("%Y/%m")
                elif interval == "quarter":
                    q = (h.recorded_at.month - 1) // 3 + 1
                    key = f"{h.recorded_at.year}-Q{q}"

                grouped_data[key] = round(h.mmr)

            for k, v in grouped_data.items():
                chart_data.append({"name": k, "rating": v})

            if interval == "hour": chart_data = chart_data[-24:]
            elif interval == "day": chart_data = chart_data[-30:]
            elif interval == "month": chart_data = chart_data[-12:]
            elif interval == "quarter": chart_data = chart_data[-10:]

        if len(history) >= 2:
            pts_change = round(history[-1].mmr - history[-2].mmr)
        else:
            pts_change = round(history[-1].mmr - 1000)

    peak_mmr = round(max([current_user.global_mmr] + [h.mmr for h in history]))

    higher_user = session.exec(
        select(User)
        .where(
            User.role != "guest",
            User.id != current_user.id,
            User.global_mmr > current_user.global_mmr,
        )
        .order_by(User.global_mmr.asc())
    ).first()
    next_rival = None
    if higher_user:
        target_rank = (rank - 1) if isinstance(rank, int) and rank > 1 else 1
        next_rival = {
            "id": str(higher_user.id),
            "name": higher_user.name,
            "avatar": higher_user.avatar_url,
            "mmr": round(higher_user.global_mmr),
            "mmr_gap": max(1, round(higher_user.global_mmr - current_user.global_mmr)),
            "target_rank": target_rank,
        }

    return {
        "rank": rank,
        "win_rate": win_rate,
        "trend": trend,
        "global_mmr": round(current_user.global_mmr),
        "matches_played": matches_played,
        "wins": wins,
        "losses": losses,
        "chart_data": chart_data,
        "pts_change": pts_change,
        "recent_form": recent_form,
        "recent_5_delta": recent_5_delta,
        "current_streak": current_streak,
        "peak_mmr": peak_mmr,
        "next_rival": next_rival,
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
            
    # 4. 👿 宿命天敵 & 黃金搭檔（批次查詢避免 N+1）
    rivals_stats = {}
    partners_stats = {}
    match_ids = list({p.match_id for p in participations})
    parts_by_match: dict[UUID, list[MatchParticipation]] = {}
    if match_ids:
        all_match_parts = session.exec(
            select(MatchParticipation).where(MatchParticipation.match_id.in_(match_ids))
        ).all()
        for mp in all_match_parts:
            parts_by_match.setdefault(mp.match_id, []).append(mp)

    for p in participations:
        for other in parts_by_match.get(p.match_id, ()):
            if other.team != p.team:
                bucket = rivals_stats.setdefault(
                    other.user_id,
                    {"matches": 0, "wins": 0, "rating_exchanged": 0.0, "user_id": other.user_id},
                )
            elif other.user_id != p.user_id:
                bucket = partners_stats.setdefault(
                    other.user_id,
                    {"matches": 0, "wins": 0, "rating_exchanged": 0.0, "user_id": other.user_id},
                )
            else:
                continue
            bucket["matches"] += 1
            if p.is_winner:
                bucket["wins"] += 1
            bucket["rating_exchanged"] += p.mmr_delta

    nemesis_candidates = [r for r in rivals_stats.values() if r["rating_exchanged"] < 0]
    sorted_rivals = sorted(
        nemesis_candidates,
        key=lambda x: (
            x["rating_exchanged"],
            x["wins"] / x["matches"] if x["matches"] > 0 else 0,
            -x["matches"],
        ),
    )[:3]

    golden_candidates = [
        g for g in partners_stats.values() if g["rating_exchanged"] > 0 and g["wins"] > 0
    ]
    sorted_partners = sorted(
        golden_candidates,
        key=lambda x: (
            x["rating_exchanged"],
            x["wins"] / x["matches"] if x["matches"] > 0 else 0,
            x["matches"],
        ),
        reverse=True,
    )[:3]

    needed_user_ids = list({item["user_id"] for item in sorted_rivals + sorted_partners})
    user_map: dict[UUID, User] = {}
    if needed_user_ids:
        user_rows = session.exec(select(User).where(User.id.in_(needed_user_ids))).all()
        user_map = {u.id: u for u in user_rows}

    def _serialize_relation(row: dict) -> dict | None:
        rel_user = user_map.get(row["user_id"])
        if not rel_user:
            return None
        matches_count = row["matches"]
        wins_count = row["wins"]
        losses_count = max(0, matches_count - wins_count)
        return {
            "id": str(rel_user.id),
            "name": rel_user.name,
            "avatar": rel_user.avatar_url,
            "winRate": int((wins_count / matches_count) * 100) if matches_count > 0 else 0,
            "wins": wins_count,
            "losses": losses_count,
            "matches": matches_count,
        }

    nemesis_list = [item for item in (_serialize_relation(r) for r in sorted_rivals) if item]
    golden_list = [item for item in (_serialize_relation(g) for g in sorted_partners) if item]

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


@router.get("/api/users/{target_id}/h2h", summary="取得我與指定選手的單/雙打交手與搭檔對比")
def get_user_h2h(
    target_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    target_user = session.get(User, target_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="找不到該玩家")

    def _empty_bucket():
        return {
            "matches": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "net_mmr": 0,
            "recent": [],
        }

    buckets = {
        "singles_vs": _empty_bucket(),
        "doubles_vs": _empty_bucket(),
        "doubles_with": _empty_bucket(),
    }

    if current_user.id == target_id:
        return {
            "is_self": True,
            "total_matches": 0,
            "total_vs_matches": 0,
            **buckets,
        }

    my_rows = session.exec(
        select(MatchParticipation, Match)
        .join(Match, MatchParticipation.match_id == Match.id)
        .where(MatchParticipation.user_id == current_user.id)
        .where(Match.status.in_(["confirmed", "completed"]))
        .order_by(Match.created_at.desc())
    ).all()

    if not my_rows:
        return {
            "is_self": False,
            "total_matches": 0,
            "total_vs_matches": 0,
            **buckets,
        }

    my_match_ids = [m.id for _p, m in my_rows]
    target_parts = session.exec(
        select(MatchParticipation)
        .where(MatchParticipation.user_id == target_id)
        .where(MatchParticipation.match_id.in_(my_match_ids))
    ).all()
    target_by_match = {tp.match_id: tp for tp in target_parts}

    for my_p, match in my_rows:
        target_p = target_by_match.get(match.id)
        if not target_p:
            continue

        same_team = my_p.team == target_p.team
        m_type = match.match_type or "singles"

        if m_type == "singles" and not same_team:
            key = "singles_vs"
        elif m_type == "doubles" and not same_team:
            key = "doubles_vs"
        elif m_type == "doubles" and same_team:
            key = "doubles_with"
        else:
            continue

        b = buckets[key]
        if my_p.is_winner:
            b["wins"] += 1
        else:
            b["losses"] += 1
        b["net_mmr"] += my_p.mmr_delta

        if len(b["recent"]) < 3:
            is_team_a = my_p.team == "A"
            b["recent"].append({
                "id": str(match.id),
                "date": ensure_utc(match.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "my_score": match.score_a if is_team_a else match.score_b,
                "opp_score": match.score_b if is_team_a else match.score_a,
                "is_winner": my_p.is_winner,
                "mmr_delta": round(my_p.mmr_delta),
                "format": match.format or "BO3",
            })

    for b in buckets.values():
        total = b["wins"] + b["losses"]
        b["matches"] = total
        b["win_rate"] = round((b["wins"] / total) * 100) if total > 0 else 0
        b["net_mmr"] = round(b["net_mmr"])

    total_vs = buckets["singles_vs"]["matches"] + buckets["doubles_vs"]["matches"]
    total_all = total_vs + buckets["doubles_with"]["matches"]

    return {
        "is_self": False,
        "total_matches": total_all,
        "total_vs_matches": total_vs,
        **buckets,
    }


def _ensure_preset_table(session: Session):
    global _preset_table_ready
    if _preset_table_ready:
        return
    MatchPreset.__table__.create(bind=session.get_bind(), checkfirst=True)
    _preset_table_ready = True


def _canonical_preset_key(
    match_type: str,
    partner_id: UUID | None,
    opp1_id: UUID | None,
    opp2_id: UUID | None,
) -> str:
    if match_type == "singles":
        return f"singles:{opp1_id or ''}"
    if opp1_id and opp2_id:
        opps = "+".join(sorted([str(opp1_id), str(opp2_id)]))
        return f"doubles:{partner_id or ''}:{opps}"
    return f"doubles:{partner_id or ''}:open"


def _normalize_label(label: str | None) -> str | None:
    if label is None:
        return None
    cleaned = label.strip()
    if not cleaned:
        return None
    if len(cleaned) > 32:
        raise HTTPException(status_code=422, detail="組合暱稱最多 32 個字")
    return cleaned


def _validate_preset_lineup(
    session: Session,
    current_user_id: UUID,
    match_type: str,
    partner_id: UUID | None,
    opp1_id: UUID | None,
    opp2_id: UUID | None,
) -> tuple[UUID | None, UUID | None, UUID | None]:
    if match_type not in ("singles", "doubles"):
        raise HTTPException(status_code=422, detail="賽制僅支援 singles 或 doubles")

    if match_type == "singles":
        partner_id = None
        opp2_id = None
        if opp1_id is None:
            raise HTTPException(status_code=422, detail="單打組合必須選擇 1 位對手")
    else:
        if partner_id is None:
            raise HTTPException(status_code=422, detail="雙打組合必須選擇 1 位搭檔")
        if (opp1_id is None) != (opp2_id is None):
            raise HTTPException(status_code=422, detail="雙打組合請選滿 2 位對手，或保留空位建立固定搭檔")

    member_ids = [uid for uid in (partner_id, opp1_id, opp2_id) if uid is not None]
    if current_user_id in member_ids:
        raise HTTPException(status_code=422, detail="對戰組合不能包含自己")
    if len(set(member_ids)) != len(member_ids):
        raise HTTPException(status_code=422, detail="同一組合中不能重複選擇相同同仁")

    if member_ids:
        found_users = session.exec(select(User).where(User.id.in_(member_ids))).all()
        if len(found_users) != len(member_ids):
            raise HTTPException(status_code=404, detail="找不到指定的同仁資料")

    return partner_id, opp1_id, opp2_id


def _serialize_presets(session: Session, presets: list[MatchPreset]) -> list[dict]:
    user_ids: set[UUID] = set()
    for p in presets:
        for uid in (p.partner_id, p.opponent1_id, p.opponent2_id):
            if uid is not None:
                user_ids.add(uid)

    user_map: dict[UUID, User] = {}
    if user_ids:
        users = session.exec(select(User).where(User.id.in_(list(user_ids)))).all()
        user_map = {u.id: u for u in users}

    def fmt_player(uid: UUID | None):
        if uid is None:
            return None
        u = user_map.get(uid)
        if not u:
            return None
        return {
            "id": str(u.id),
            "name": u.name,
            "avatar": u.avatar_url,
            "department": u.department,
        }

    return [
        {
            "id": str(p.id),
            "match_type": p.match_type,
            "label": p.label,
            "sort_order": p.sort_order,
            "partner": fmt_player(p.partner_id),
            "opponent1": fmt_player(p.opponent1_id),
            "opponent2": fmt_player(p.opponent2_id),
            "created_at": ensure_utc(p.created_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        for p in presets
    ]


@router.get("/api/users/me/presets", summary="取得我的常用約戰組合")
def get_my_match_presets(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _ensure_preset_table(session)
    presets = session.exec(
        select(MatchPreset)
        .where(MatchPreset.user_id == current_user.id)
        .order_by(MatchPreset.sort_order.asc(), MatchPreset.created_at.desc())
    ).all()
    return _serialize_presets(session, list(presets))


@router.post("/api/users/me/presets", summary="新增常用約戰組合")
def create_my_match_preset(
    req: MatchPresetCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _ensure_preset_table(session)
    existing = list(
        session.exec(
            select(MatchPreset).where(MatchPreset.user_id == current_user.id)
        ).all()
    )
    if len(existing) >= MAX_MATCH_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"常用約戰組合上限為 {MAX_MATCH_PRESETS} 組，請先刪除不常用的組合",
        )

    partner_id, opp1_id, opp2_id = _validate_preset_lineup(
        session,
        current_user.id,
        req.match_type,
        req.partner_id,
        req.opponent1_id,
        req.opponent2_id,
    )
    new_key = _canonical_preset_key(req.match_type, partner_id, opp1_id, opp2_id)
    for item in existing:
        existing_key = _canonical_preset_key(
            item.match_type, item.partner_id, item.opponent1_id, item.opponent2_id
        )
        if existing_key == new_key:
            raise HTTPException(status_code=409, detail="此對戰組合已經在常用清單中")

    clean_label = _normalize_label(req.label)
    next_sort = (min(item.sort_order for item in existing) - 1) if existing else 0

    preset = MatchPreset(
        user_id=current_user.id,
        match_type=req.match_type,
        label=clean_label,
        partner_id=partner_id,
        opponent1_id=opp1_id,
        opponent2_id=opp2_id,
        sort_order=next_sort,
    )
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return _serialize_presets(session, [preset])[0]


@router.patch("/api/users/me/presets/{preset_id}", summary="更新或置頂常用約戰組合")
def update_my_match_preset(
    preset_id: UUID,
    req: MatchPresetUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _ensure_preset_table(session)
    preset = session.get(MatchPreset, preset_id)
    if not preset or preset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="找不到此常用組合")

    fields = req.model_fields_set
    next_match_type = req.match_type if "match_type" in fields and req.match_type else preset.match_type
    next_partner_id = req.partner_id if "partner_id" in fields else preset.partner_id
    next_opp1_id = req.opponent1_id if "opponent1_id" in fields else preset.opponent1_id
    next_opp2_id = req.opponent2_id if "opponent2_id" in fields else preset.opponent2_id

    partner_id, opp1_id, opp2_id = _validate_preset_lineup(
        session,
        current_user.id,
        next_match_type,
        next_partner_id,
        next_opp1_id,
        next_opp2_id,
    )

    next_key = _canonical_preset_key(next_match_type, partner_id, opp1_id, opp2_id)
    others = session.exec(
        select(MatchPreset)
        .where(MatchPreset.user_id == current_user.id)
        .where(MatchPreset.id != preset.id)
    ).all()
    for other in others:
        if _canonical_preset_key(other.match_type, other.partner_id, other.opponent1_id, other.opponent2_id) == next_key:
            raise HTTPException(status_code=409, detail="與其他已收藏的對戰組合重複")

    preset.match_type = next_match_type
    preset.partner_id = partner_id
    preset.opponent1_id = opp1_id
    preset.opponent2_id = opp2_id
    if "label" in fields:
        preset.label = _normalize_label(req.label)
    if "sort_order" in fields and req.sort_order is not None:
        preset.sort_order = req.sort_order
    preset.updated_at = utc_now()

    session.add(preset)
    session.commit()
    session.refresh(preset)
    return _serialize_presets(session, [preset])[0]


@router.delete("/api/users/me/presets/{preset_id}", summary="刪除常用約戰組合")
def delete_my_match_preset(
    preset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _ensure_preset_table(session)
    preset = session.get(MatchPreset, preset_id)
    if not preset or preset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="找不到此常用組合")

    session.delete(preset)
    session.commit()
    return {"message": "已移除常用組合", "id": str(preset_id)}


# ==========================================
# 個人通知中心 (Notifications)
# ==========================================
_ARBITRATION_KEYWORDS = (
    "管理員",
    "裁決",
    "撤銷",
    "駁回",
    "回滾",
    "校準",
    "更正",
    "補登",
    "未出賽",
    "扣除",
    "角色",
)


def _classify_notification_category(notif: Notification) -> str:
    if notif.type and notif.type.startswith("challenge_"):
        return "challenge"
    content = notif.content or ""
    if notif.type == "pending_confirm":
        return "action_required"
    if notif.type == "match_disputed":
        return "disputed"
    if "賽季" in content or "錦標賽" in content:
        return "season"
    if any(kw in content for kw in _ARBITRATION_KEYWORDS):
        return "arbitration"
    return "match_settled"


@router.get("/api/users/me/notifications", summary="取得個人通知中心清單與未讀統計")
def get_my_notifications(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    all_notifs = session.exec(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    ).all()

    unread_count = sum(1 for n in all_notifs if not n.is_read)
    safe_limit = max(1, min(100, limit))
    sliced = all_notifs[:safe_limit]

    match_ids = list({n.match_id for n in sliced if n.match_id is not None})
    match_status_map: dict[UUID, str] = {}
    match_context_map: dict[UUID, dict] = {}
    if match_ids:
        matches = session.exec(select(Match).where(Match.id.in_(match_ids))).all()
        match_status_map = {m.id: m.status for m in matches}

        involved_user_ids = list({
            uid
            for m in matches
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id)
            if uid is not None
        })
        user_map: dict[UUID, User] = {}
        if involved_user_ids:
            users_rows = session.exec(select(User).where(User.id.in_(involved_user_ids))).all()
            user_map = {u.id: u for u in users_rows}

        for m in matches:
            m_utc = ensure_utc(m.created_at)
            team_a_players = []
            for uid in (m.team_a_p1_id, m.team_a_p2_id):
                u = user_map.get(uid) if uid else None
                if u:
                    team_a_players.append({
                        "id": str(u.id),
                        "name": u.name,
                        "avatar_url": u.avatar_url,
                    })

            team_b_players = []
            for uid in (m.team_b_p1_id, m.team_b_p2_id):
                u = user_map.get(uid) if uid else None
                if u:
                    team_b_players.append({
                        "id": str(u.id),
                        "name": u.name,
                        "avatar_url": u.avatar_url,
                    })

            match_context_map[m.id] = {
                "id": str(m.id),
                "short_id": str(m.id)[:4],
                "status": m.status,
                "match_type": m.match_type,
                "format": m.format,
                "score_a": m.score_a,
                "score_b": m.score_b,
                "created_at": m_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if m_utc else None,
                "team_a": team_a_players,
                "team_b": team_b_players,
            }

    serialized = []
    for n in sliced:
        created_utc = ensure_utc(n.created_at)
        serialized.append({
            "id": str(n.id),
            "type": n.type,
            "category": _classify_notification_category(n),
            "content": n.content,
            "match_id": str(n.match_id) if n.match_id else None,
            "match_status": match_status_map.get(n.match_id) if n.match_id else None,
            "match_context": match_context_map.get(n.match_id) if n.match_id else None,
            "is_read": n.is_read,
            "created_at": created_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if created_utc else None,
        })

    return {
        "unread_count": unread_count,
        "total_count": len(all_notifs),
        "notifications": serialized,
    }


@router.patch("/api/users/me/notifications/{notification_id}/read", summary="標記單則通知為已讀")
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    notif = session.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="找不到此通知")

    if not notif.is_read:
        notif.is_read = True
        session.add(notif)
        session.commit()

    return {"id": str(notif.id), "is_read": True}


@router.post("/api/users/me/notifications/read-all", summary="將所有未讀通知標記為已讀")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    unread_rows = session.exec(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    ).all()

    count = 0
    for notif in unread_rows:
        notif.is_read = True
        session.add(notif)
        count += 1

    if count > 0:
        session.commit()

    return {"marked_count": count}


@router.delete("/api/users/me/notifications/clear-read", summary="清除所有已讀通知")
def clear_read_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    read_rows = session.exec(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == True,
        )
    ).all()

    count = 0
    for notif in read_rows:
        session.delete(notif)
        count += 1

    if count > 0:
        session.commit()

    return {"deleted_count": count}