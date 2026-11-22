from datetime import datetime, timedelta, timezone
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import Season, SeasonRecord, User, Match, MatchParticipation
from services.season_service import get_current_season

router = APIRouter(tags=["Leaderboard"])


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """將可能不含時區的 datetime 正規化為 UTC aware datetime。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _extract_user_outcomes(
    matches: list[Match],
    part_delta_map: dict[tuple, float],
) -> dict:
    """從已結算比賽列表（需已按 created_at 降序）抽取每位玩家的勝負與積分變動。"""
    outcomes: dict = {}
    for m in matches:
        a_won = m.score_a > m.score_b
        team_a = [uid for uid in (m.team_a_p1_id, m.team_a_p2_id) if uid is not None]
        team_b = [uid for uid in (m.team_b_p1_id, m.team_b_p2_id) if uid is not None]
        created_utc = _ensure_utc(m.created_at)

        for uid in team_a:
            delta = part_delta_map.get((m.id, uid))
            if delta is None:
                raw = float(m.mmr_exchanged or 0.0)
                delta = raw if a_won else -raw
            outcomes.setdefault(uid, []).append({
                "won": a_won,
                "delta": delta,
                "created_at": created_utc,
                "season_id": m.season_id,
            })

        for uid in team_b:
            won = not a_won
            delta = part_delta_map.get((m.id, uid))
            if delta is None:
                raw = float(m.mmr_exchanged or 0.0)
                delta = raw if won else -raw
            outcomes.setdefault(uid, []).append({
                "won": won,
                "delta": delta,
                "created_at": created_utc,
                "season_id": m.season_id,
            })

    return outcomes


def _compute_streak(outcomes: list[dict]) -> int:
    """計算當前連續勝（正數）或連續敗（負數）場數，outcomes 需由新到舊排序。"""
    if not outcomes:
        return 0
    first_won = outcomes[0]["won"]
    streak = 0
    for item in outcomes:
        if item["won"] == first_won:
            streak += 1
        else:
            break
    return streak if first_won else -streak


def _compute_weekly_delta(outcomes: list[dict], cutoff_7d: datetime) -> int:
    """計算近 7 天內的累計 ELO 淨變動。"""
    total = sum(
        o["delta"]
        for o in outcomes
        if o["created_at"] is not None and o["created_at"] >= cutoff_7d
    )
    return round(total)


def _compute_season_pulse(
    active_season: Optional[Season],
    all_settled_matches: list[Match],
    users: list[User],
    season_records_map: dict,
    season_outcomes: dict,
    now_utc: datetime,
) -> Optional[dict]:
    """計算首頁右欄的「賽季脈動」總覽與倒數資訊。"""
    if not active_season:
        return None

    start_utc = _ensure_utc(active_season.start_date)
    end_utc = _ensure_utc(active_season.end_date)

    if end_utc:
        remaining_seconds = (end_utc - now_utc).total_seconds()
        days_remaining: Optional[int] = (
            max(0, math.ceil(remaining_seconds / 86400)) if remaining_seconds > 0 else 0
        )
    else:
        days_remaining = None

    if start_utc and end_utc and end_utc > start_utc:
        elapsed = (now_utc - start_utc).total_seconds()
        span = (end_utc - start_utc).total_seconds()
        progress_percent: Optional[int] = max(0, min(100, round((elapsed / span) * 100)))
    else:
        progress_percent = None

    season_matches = [m for m in all_settled_matches if m.season_id == active_season.id]
    cutoff_7d = now_utc - timedelta(days=7)
    matches_last_7d = sum(
        1 for m in all_settled_matches
        if (_ensure_utc(m.created_at) or now_utc) >= cutoff_7d
    )
    active_user_ids = {
        u.id
        for u in users
        if (season_records_map.get(u.id) and season_records_map[u.id].matches_played > 0)
        or len(season_outcomes.get(u.id, [])) > 0
    }

    return {
        "season_id": active_season.id,
        "season_name": active_season.name,
        "status": active_season.status,
        "start_date": start_utc.isoformat() if start_utc else None,
        "end_date": end_utc.isoformat() if end_utc else None,
        "days_remaining": days_remaining,
        "progress_percent": progress_percent,
        "total_matches": len(season_matches),
        "active_players": len(active_user_ids),
        "matches_last_7d": matches_last_7d,
        "total_members": len(users),
    }


def _user_spotlight_base(u: User) -> dict:
    return {
        "player_id": str(u.id),
        "player_name": u.name,
        "department": u.department,
        "avatar_url": u.avatar_url,
        "global_mmr": round(u.global_mmr),
    }


def _compute_spotlights(
    users: list[User],
    all_outcomes: dict,
    season_outcomes: dict,
    now_utc: datetime,
) -> dict:
    """計算俱樂部焦點人物：連勝火熱王、飆分王、活躍戰神。"""
    # 1. 連勝火熱王 (Hot Streak)
    streak_candidates = []
    for u in users:
        s = _compute_streak(all_outcomes.get(u.id, []))
        if s >= 1:
            streak_candidates.append((s, u.global_mmr, u))

    preferred_streaks = [c for c in streak_candidates if c[0] >= 2]
    chosen_pool = preferred_streaks if preferred_streaks else streak_candidates
    hot_streak = None
    if chosen_pool:
        best_streak, _, best_user = max(chosen_pool, key=lambda x: (x[0], x[1]))
        hot_streak = {**_user_spotlight_base(best_user), "streak": best_streak}

    # 2. 飆分王 (Weekly Climber -> 30d fallback -> net gain fallback)
    cutoff_7d = now_utc - timedelta(days=7)
    cutoff_30d = now_utc - timedelta(days=30)

    def _best_climber(window_cutoff: Optional[datetime], label: str) -> Optional[dict]:
        candidates = []
        for u in users:
            if window_cutoff is not None:
                delta = round(
                    sum(
                        o["delta"]
                        for o in all_outcomes.get(u.id, [])
                        if o["created_at"] is not None and o["created_at"] >= window_cutoff
                    )
                )
            else:
                delta = round(u.global_mmr - 1000)
            if delta > 0:
                candidates.append((delta, u.global_mmr, u))
        if not candidates:
            return None
        best_delta, _, best_u = max(candidates, key=lambda x: (x[0], x[1]))
        return {
            **_user_spotlight_base(best_u),
            "mmr_delta": best_delta,
            "window_label": label,
        }

    weekly_climber = (
        _best_climber(cutoff_7d, "近 7 天")
        or _best_climber(cutoff_30d, "近 30 天")
        or _best_climber(None, "累計漲幅")
    )

    # 3. 活躍戰神 (Most Active in current season -> all-time fallback)
    def _best_active(outcome_source: dict, scope_label: str) -> Optional[dict]:
        candidates = []
        for u in users:
            outs = outcome_source.get(u.id, [])
            if outs:
                wins = sum(1 for o in outs if o["won"])
                candidates.append((len(outs), wins, u.global_mmr, u))
        if not candidates:
            return None
        cnt, wins, _, best_u = max(candidates, key=lambda x: (x[0], x[1], x[2]))
        return {
            **_user_spotlight_base(best_u),
            "matches_count": cnt,
            "wins": wins,
            "scope_label": scope_label,
        }

    most_active = (
        _best_active(season_outcomes, "本季出賽")
        or _best_active(all_outcomes, "生涯出賽")
    )

    return {
        "hot_streak": hot_streak,
        "weekly_climber": weekly_climber,
        "most_active": most_active,
    }


@router.get("/api/leaderboard", summary="取得本季排行榜與動能指標")
def get_leaderboard(season_id: Optional[str] = None, session: Session = Depends(get_session)):
    now_utc = datetime.now(timezone.utc)
    cutoff_7d = now_utc - timedelta(days=7)

    all_users = session.exec(select(User).where(User.role != "guest")).all()
    active_users = [u for u in all_users if u.is_active]
    all_settled_matches = session.exec(
        select(Match)
        .where(Match.status.in_(["confirmed", "completed"]))
        .order_by(Match.created_at.desc())
    ).all()
    all_parts = session.exec(select(MatchParticipation)).all()
    part_delta_map = {
        (p.match_id, p.user_id): float(p.mmr_delta or 0.0)
        for p in all_parts
    }

    all_outcomes = _extract_user_outcomes(all_settled_matches, part_delta_map)

    active_season = get_current_season(session)
    if active_season:
        active_season_matches = [
            m for m in all_settled_matches if m.season_id == active_season.id
        ]
        active_season_outcomes = _extract_user_outcomes(active_season_matches, part_delta_map)
        active_season_records = session.exec(
            select(SeasonRecord).where(SeasonRecord.season_id == active_season.id)
        ).all()
        active_season_records_map = {r.user_id: r for r in active_season_records}
    else:
        active_season_outcomes = {}
        active_season_records_map = {}

    season_pulse = _compute_season_pulse(
        active_season=active_season,
        all_settled_matches=all_settled_matches,
        users=active_users,
        season_records_map=active_season_records_map,
        season_outcomes=active_season_outcomes,
        now_utc=now_utc,
    )
    spotlights = _compute_spotlights(
        users=active_users,
        all_outcomes=all_outcomes,
        season_outcomes=active_season_outcomes,
        now_utc=now_utc,
    )

    # 🌟 0. All-Time 歷史生涯總榜
    if season_id == "all-time":
        all_time_users = [
            u for u in all_users if u.is_active or len(all_outcomes.get(u.id, [])) > 0
        ]
        combined_data = []
        for user in all_time_users:
            outs = all_outcomes.get(user.id, [])
            matches_played = len(outs)
            wins = sum(1 for o in outs if o["won"])
            recent_form = ["W" if o["won"] else "L" for o in outs[:5]]
            combined_data.append({
                "user": user,
                "matches_played": matches_played,
                "wins": wins,
                "recent_form": recent_form,
                "current_streak": _compute_streak(outs),
                "weekly_mmr_delta": _compute_weekly_delta(outs, cutoff_7d),
                "display_mmr": user.global_mmr,
            })

        active_data = [d for d in combined_data if d["matches_played"] > 0]
        inactive_data = [d for d in combined_data if d["matches_played"] == 0]
        active_data.sort(key=lambda x: x["display_mmr"], reverse=True)
        inactive_data.sort(key=lambda x: x["display_mmr"], reverse=True)

        current_rank = 1
        for i, data in enumerate(active_data):
            if i > 0 and data["display_mmr"] < active_data[i - 1]["display_mmr"]:
                current_rank = i + 1
            data["computed_rank"] = current_rank

        for data in inactive_data:
            data["computed_rank"] = "-"

        leaderboard_data = []
        for data in active_data + inactive_data:
            user = data["user"]
            matches_played = data["matches_played"]
            wins = data["wins"]
            win_rate_val = (wins / matches_played) * 100 if matches_played > 0 else 0.0
            leaderboard_data.append({
                "rank": data["computed_rank"],
                "player_id": str(user.id),
                "player_name": user.name,
                "department": user.department,
                "avatar_url": user.avatar_url,
                "matches_played": matches_played,
                "global_mmr": round(data["display_mmr"]),
                "wins": wins,
                "losses": matches_played - wins,
                "win_rate": f"{win_rate_val:.1f}%",
                "trend": "0",
                "recent_form": data["recent_form"],
                "current_streak": data["current_streak"],
                "weekly_mmr_delta": data["weekly_mmr_delta"],
            })

        return {
            "season_id": "all-time",
            "season_name": "All-Time 歷史總榜",
            "leaderboard": leaderboard_data,
            "season_pulse": season_pulse,
            "spotlights": spotlights,
        }

    # 🌟 1. 取得指定或目前的賽季
    if season_id:
        season = session.get(Season, season_id)
        if not season:
            raise HTTPException(status_code=404, detail="找不到指定的賽季")
    else:
        season = active_season

    if not season:
        return {
            "season_id": None,
            "season_name": "休賽季",
            "leaderboard": [],
            "season_pulse": None,
            "spotlights": spotlights,
        }

    if active_season and season.id == active_season.id:
        record_map = active_season_records_map
        target_season_outcomes = active_season_outcomes
    else:
        records = session.exec(
            select(SeasonRecord).where(SeasonRecord.season_id == season.id)
        ).all()
        record_map = {r.user_id: r for r in records}
        season_matches = [m for m in all_settled_matches if m.season_id == season.id]
        target_season_outcomes = _extract_user_outcomes(season_matches, part_delta_map)

    # 🌟 2. 撈取所有玩家與他們在本季的戰績（含 MatchParticipation/Match 保底補齊）
    season_users = active_users if season.status == "active" else all_users
    combined_data = []
    for user in season_users:
        record = record_map.get(user.id)
        user_season_outs = target_season_outcomes.get(user.id, [])

        if record and record.matches_played > 0:
            matches_played = record.matches_played
            wins = record.wins
            previous_rank = record.previous_rank
        elif len(user_season_outs) > 0:
            matches_played = len(user_season_outs)
            wins = sum(1 for o in user_season_outs if o["won"])
            previous_rank = record.previous_rank if record else None
        else:
            matches_played = 0
            wins = 0
            previous_rank = None

        if season.status != "active" and not user.is_active and matches_played == 0:
            continue

        display_mmr = (
            record.final_mmr
            if (season.status == "completed" and record and record.final_mmr is not None)
            else user.global_mmr
        )

        combined_data.append({
            "user": user,
            "matches_played": matches_played,
            "wins": wins,
            "previous_rank": previous_rank,
            "display_mmr": display_mmr,
            "season_outcomes": user_season_outs,
        })

    # 🌟 2-B. 區分有/無比賽紀錄玩家，兩者皆依 ELO 降序排列
    active_data = [d for d in combined_data if d["matches_played"] > 0]
    inactive_data = [d for d in combined_data if d["matches_played"] == 0]

    active_data.sort(key=lambda x: x["display_mmr"], reverse=True)
    inactive_data.sort(key=lambda x: x["display_mmr"], reverse=True)

    current_rank = 1
    for i, data in enumerate(active_data):
        if i > 0 and data["display_mmr"] < active_data[i - 1]["display_mmr"]:
            current_rank = i + 1
        data["computed_rank"] = current_rank

    for data in inactive_data:
        data["computed_rank"] = "-"

    final_combined = active_data + inactive_data

    # 📈 3. 處理勝率、動能趨勢與焦點指標
    leaderboard_data = []
    for data in final_combined:
        user = data["user"]
        matches_played = data["matches_played"]
        wins = data["wins"]
        previous_rank = data["previous_rank"]
        computed_rank = data["computed_rank"]
        user_season_outs = data["season_outcomes"]
        user_all_outs = all_outcomes.get(user.id, [])

        win_rate_val = (wins / matches_played) * 100 if matches_played > 0 else 0.0
        win_rate_str = f"{win_rate_val:.1f}%"

        trend_str = "0"
        if previous_rank is not None and computed_rank != "-":
            try:
                prev_rnk = int(previous_rank)
                curr_rnk = int(computed_rank)
                if curr_rnk < prev_rnk:
                    trend_str = f"+{prev_rnk - curr_rnk}"
                elif curr_rnk > prev_rnk:
                    trend_str = f"-{curr_rnk - prev_rnk}"
            except (ValueError, TypeError):
                pass

        recent_form = ["W" if o["won"] else "L" for o in user_season_outs[:5]]

        leaderboard_data.append({
            "rank": computed_rank,
            "player_id": str(user.id),
            "player_name": user.name,
            "department": user.department,
            "avatar_url": user.avatar_url,
            "matches_played": matches_played,
            "global_mmr": round(data["display_mmr"]),
            "wins": wins,
            "losses": matches_played - wins,
            "win_rate": win_rate_str,
            "trend": trend_str,
            "recent_form": recent_form,
            "current_streak": _compute_streak(user_all_outs),
            "weekly_mmr_delta": _compute_weekly_delta(user_all_outs, cutoff_7d),
        })

    return {
        "season_id": season.id,
        "season_name": season.name,
        "leaderboard": leaderboard_data,
        "season_pulse": season_pulse,
        "spotlights": spotlights,
    }