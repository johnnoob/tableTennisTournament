"""
services/analytics_service.py

負責計算選手的「劇情式 ELO 走勢圖資料」與「全方位實戰數據分析（五維雷達、球風稱號、比分結構、對戰段位與出勤脈動）」。
所有查詢皆採批次 IN 查詢，嚴格避免 N+1 問題，並相容無歷史紀錄與新手未滿 5 場情境。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlmodel import Session, select

from models import Match, MatchParticipation, PlayerStatHistory, Season, User
from services.season_service import ensure_utc

TW_TZ = timezone(timedelta(hours=8))


def _bucket_key_for_legacy_interval(dt_utc: datetime, interval: str) -> str:
    local_dt = dt_utc.astimezone(TW_TZ)
    if interval == "hour":
        return local_dt.strftime("%m/%d %H:00")
    if interval == "day":
        return local_dt.strftime("%m/%d")
    if interval == "month":
        return local_dt.strftime("%Y/%m")
    if interval == "quarter":
        q = (local_dt.month - 1) // 3 + 1
        return f"{local_dt.year}-Q{q}"
    return local_dt.strftime("%m/%d")


def _tier_for_mmr(mmr: float) -> str:
    if mmr >= 1320:
        return "elite"
    if mmr >= 1180:
        return "gold"
    if mmr >= 1050:
        return "silver"
    return "bronze"


def _bayesian_score(
    successes: float,
    total: int,
    prior_weight: float = 3.0,
    prior_mean: float = 0.5,
    min_floor: int = 15,
) -> int:
    if total <= 0:
        return round(prior_mean * 100)
    raw = ((successes + prior_weight * prior_mean) / (total + prior_weight)) * 100.0
    return max(min_floor, min(99, round(raw)))


def build_story_chart_data(
    session: Session,
    user: User,
    history: list[PlayerStatHistory],
    active_season: Optional[Season] = None,
    interval: str = "recent",
    max_points: Optional[int] = None,
) -> tuple[list[dict], dict]:
    """
    將 PlayerStatHistory 轉換為富含對戰脈絡的走勢圖資料點與區間摘要 KPI。
    向下相容 {name, rating, event_type} 欄位，並附帶 match_id / opponents / score / delta / result。
    """
    current_rating = round(float(user.global_mmr))

    if not history:
        start_point = {
            "idx": 1,
            "name": "基準起始",
            "recorded_at": None,
            "rating": current_rating,
            "delta": 0.0,
            "event_type": "start",
        }
        summary = {
            "net_delta": 0,
            "matches": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "peak_rating": current_rating,
            "low_rating": current_rating,
            "current_rating": current_rating,
        }
        return [start_point], summary

    # 相容舊有時間聚合參數 (hour / day / month / quarter)
    if interval in ("hour", "day", "month", "quarter"):
        grouped: dict[str, dict] = {}
        for h in history:
            dt_utc = ensure_utc(h.recorded_at) or datetime.now(timezone.utc)
            key = _bucket_key_for_legacy_interval(dt_utc, interval)
            grouped[key] = {
                "name": key,
                "recorded_at": dt_utc.isoformat(),
                "rating": round(float(h.mmr)),
                "event_type": h.event_type or "match",
            }
        points = list(grouped.values())
        if interval == "hour":
            points = points[-24:]
        elif interval == "day":
            points = points[-30:]
        elif interval == "month":
            points = points[-12:]
        elif interval == "quarter":
            points = points[-10:]

        for idx, pt in enumerate(points, start=1):
            pt["idx"] = idx
            prev_r = points[idx - 2]["rating"] if idx >= 2 else pt["rating"]
            pt["delta"] = round(float(pt["rating"] - prev_r), 1)

        ratings = [p["rating"] for p in points]
        net = round(points[-1]["rating"] - points[0]["rating"]) if len(points) >= 2 else 0
        summary = {
            "net_delta": net,
            "matches": len(points),
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "peak_rating": max(ratings) if ratings else current_rating,
            "low_rating": min(ratings) if ratings else current_rating,
            "current_rating": current_rating,
        }
        return points, summary

    # 依競技區間選取切片 (recent / recent30 / season / all)
    if interval == "recent30":
        start_idx = max(0, len(history) - 30)
        selected_history = history[start_idx:]
    elif interval == "season" and active_season and active_season.start_date:
        season_start = ensure_utc(active_season.start_date)
        start_idx = next(
            (
                i
                for i, h in enumerate(history)
                if (ensure_utc(h.recorded_at) or season_start) >= season_start
            ),
            len(history),
        )
        selected_history = history[start_idx:]
    elif interval == "all":
        start_idx = max(0, len(history) - 60)
        selected_history = history[start_idx:]
    else:
        limit = max_points if (max_points and max_points > 0) else 10
        start_idx = max(0, len(history) - limit)
        selected_history = history[start_idx:]

    if not selected_history:
        baseline_point = {
            "idx": 1,
            "name": "本季起點",
            "recorded_at": ensure_utc(active_season.start_date).isoformat()
            if active_season and active_season.start_date
            else None,
            "rating": current_rating,
            "delta": 0.0,
            "event_type": "start",
        }
        summary = {
            "net_delta": 0,
            "matches": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "peak_rating": current_rating,
            "low_rating": current_rating,
            "current_rating": current_rating,
        }
        return [baseline_point], summary

    # 批次撈取關聯 Match / MatchParticipation / User
    match_ids = list({h.match_id for h in selected_history if h.match_id is not None})
    matches_map: dict[UUID, Match] = {}
    parts_by_match: dict[UUID, list[MatchParticipation]] = {}
    users_map: dict[UUID, User] = {}

    if match_ids:
        match_rows = session.exec(select(Match).where(Match.id.in_(match_ids))).all()
        matches_map = {m.id: m for m in match_rows}

        part_rows = session.exec(
            select(MatchParticipation).where(MatchParticipation.match_id.in_(match_ids))
        ).all()
        for mp in part_rows:
            parts_by_match.setdefault(mp.match_id, []).append(mp)

        needed_uids: set[UUID] = set()
        for m in match_rows:
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id):
                if uid is not None and uid != user.id:
                    needed_uids.add(uid)
        if needed_uids:
            user_rows = session.exec(select(User).where(User.id.in_(list(needed_uids)))).all()
            users_map = {u.id: u for u in user_rows}

    prev_mmr = float(history[start_idx - 1].mmr) if start_idx > 0 else 1000.0
    baseline_before_slice = prev_mmr

    points: list[dict] = []
    match_count = 0
    win_count = 0
    loss_count = 0

    for idx, h in enumerate(selected_history, start=1):
        dt_utc = ensure_utc(h.recorded_at) or datetime.now(timezone.utc)
        mmr_val = float(h.mmr)
        raw_event = h.event_type or "match"
        if raw_event == "match" and h.match_id is None:
            event_type = "admin_adjust"
        else:
            event_type = raw_event

        point: dict = {
            "idx": idx,
            "name": f"#{idx}",
            "recorded_at": dt_utc.isoformat(),
            "rating": round(mmr_val),
            "delta": round(mmr_val - prev_mmr, 1),
            "event_type": event_type,
        }

        if h.match_id and h.match_id in matches_map:
            m = matches_map[h.match_id]
            in_a = user.id in (m.team_a_p1_id, m.team_a_p2_id)
            a_won = m.score_a > m.score_b
            i_won = (in_a and a_won) or (not in_a and not a_won)
            my_score = m.score_a if in_a else m.score_b
            opp_score = m.score_b if in_a else m.score_a

            my_part = next(
                (p for p in parts_by_match.get(m.id, ()) if p.user_id == user.id),
                None,
            )
            if my_part is not None:
                point["delta"] = round(float(my_part.mmr_delta), 1)
            elif m.mmr_exchanged:
                ex = round(float(m.mmr_exchanged), 1)
                point["delta"] = ex if i_won else -ex

            opp_ids = [
                uid
                for uid in ((m.team_b_p1_id, m.team_b_p2_id) if in_a else (m.team_a_p1_id, m.team_a_p2_id))
                if uid is not None
            ]
            partner_ids = [
                uid
                for uid in ((m.team_a_p1_id, m.team_a_p2_id) if in_a else (m.team_b_p1_id, m.team_b_p2_id))
                if uid is not None and uid != user.id
            ]

            point["match_id"] = str(m.id)
            point["match_type"] = m.match_type or "singles"
            point["format"] = m.format or "BO3"
            point["result"] = "W" if i_won else "L"
            point["score"] = f"{my_score}:{opp_score}"
            point["opponents"] = [
                {
                    "id": str(users_map[uid].id),
                    "name": users_map[uid].name,
                    "mmr": round(float(users_map[uid].global_mmr)),
                }
                for uid in opp_ids
                if uid in users_map
            ]
            if partner_ids and partner_ids[0] in users_map:
                pu = users_map[partner_ids[0]]
                point["partner"] = {"id": str(pu.id), "name": pu.name}
            else:
                point["partner"] = None

            match_count += 1
            if i_won:
                win_count += 1
            else:
                loss_count += 1

        prev_mmr = mmr_val
        points.append(point)

    ratings = [p["rating"] for p in points]
    if start_idx > 0 or len(points) == 1:
        net_delta = round(points[-1]["rating"] - baseline_before_slice)
    else:
        # 從最初起點看全程淨變動（扣除軟重置前也直覺）
        net_delta = round(points[-1]["rating"] - 1000.0)

    win_rate = round((win_count / match_count) * 100) if match_count > 0 else 0
    summary = {
        "net_delta": net_delta,
        "matches": match_count,
        "wins": win_count,
        "losses": loss_count,
        "win_rate": win_rate,
        "peak_rating": max(ratings) if ratings else current_rating,
        "low_rating": min(ratings) if ratings else current_rating,
        "current_rating": current_rating,
    }
    return points, summary


def build_player_analytics(
    session: Session,
    user: User,
    settled_matches: list[Match],
) -> dict:
    """
    計算五維球風雷達、個人戰術稱號、單雙打對照、比分結構 (Scoreline DNA)、
    對戰段位階梯以及近 8 週出勤節奏。
    """
    unlock_required = 5
    settled_count = len(settled_matches)
    unlocked = settled_count >= unlock_required

    match_ids = [m.id for m in settled_matches]
    part_delta_map: dict[UUID, float] = {}
    users_map: dict[UUID, User] = {}

    if match_ids:
        my_parts = session.exec(
            select(MatchParticipation).where(
                MatchParticipation.match_id.in_(match_ids),
                MatchParticipation.user_id == user.id,
            )
        ).all()
        for mp in my_parts:
            part_delta_map[mp.match_id] = float(mp.mmr_delta or 0.0)

        opp_uids: set[UUID] = set()
        for m in settled_matches:
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id):
                if uid is not None and uid != user.id:
                    opp_uids.add(uid)
        if opp_uids:
            opp_rows = session.exec(select(User).where(User.id.in_(list(opp_uids)))).all()
            users_map = {u.id: u for u in opp_rows}

    singles = {"matches": 0, "wins": 0, "losses": 0, "net_mmr": 0.0}
    doubles = {"matches": 0, "wins": 0, "losses": 0, "net_mmr": 0.0}

    sweep_win = 0
    close_win = 0
    close_loss = 0
    sweep_loss = 0

    my_sets_total = 0
    opp_sets_total = 0

    clutch_matches = 0
    clutch_wins = 0

    giant_matches = 0
    giant_wins = 0

    tier_buckets: dict[str, dict] = {
        "elite": {"key": "elite", "label": "菁英", "range": "1320+", "matches": 0, "wins": 0, "losses": 0},
        "gold": {"key": "gold", "label": "金牌", "range": "1180~1319", "matches": 0, "wins": 0, "losses": 0},
        "silver": {"key": "silver", "label": "銀牌", "range": "1050~1179", "matches": 0, "wins": 0, "losses": 0},
        "bronze": {"key": "bronze", "label": "銅牌", "range": "<1050", "matches": 0, "wins": 0, "losses": 0},
    }

    # 建立近 8 週 (以週一 00:00 UTC+8 為準) 的空桶
    now_tw = datetime.now(TW_TZ)
    current_monday = (now_tw - timedelta(days=now_tw.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_starts = [current_monday - timedelta(weeks=offset) for offset in range(7, -1, -1)]
    week_map: dict[str, dict] = {
        ws.strftime("%Y-%m-%d"): {
            "label": ws.strftime("%m/%d"),
            "matches": 0,
            "wins": 0,
        }
        for ws in week_starts
    }

    user_mmr = float(user.global_mmr)

    for m in settled_matches:
        in_a = user.id in (m.team_a_p1_id, m.team_a_p2_id)
        a_won = m.score_a > m.score_b
        i_won = (in_a and a_won) or (not in_a and not a_won)

        my_score = int(m.score_a if in_a else m.score_b)
        opp_score = int(m.score_b if in_a else m.score_a)
        my_sets_total += my_score
        opp_sets_total += opp_score

        delta = part_delta_map.get(m.id)
        if delta is None:
            raw = float(m.mmr_exchanged or 0.0)
            delta = raw if i_won else -raw

        target_split = doubles if m.match_type == "doubles" else singles
        target_split["matches"] += 1
        if i_won:
            target_split["wins"] += 1
        else:
            target_split["losses"] += 1
        target_split["net_mmr"] += delta

        # 比分結構 4 分類
        if i_won:
            if opp_score == 0:
                sweep_win += 1
            else:
                close_win += 1
        else:
            if my_score == 0:
                sweep_loss += 1
            else:
                close_loss += 1

        # 決勝局（打到最後一局且分差 1 局，如 2:1 / 3:2）
        fmt = (m.format or "BO3").upper()
        is_decider = (
            (fmt == "BO3" and my_score + opp_score == 3 and abs(my_score - opp_score) == 1)
            or (fmt == "BO5" and my_score + opp_score == 5 and abs(my_score - opp_score) == 1)
            or (abs(my_score - opp_score) == 1 and max(my_score, opp_score) >= 2)
        )
        if is_decider:
            clutch_matches += 1
            if i_won:
                clutch_wins += 1

        # 對手平均 ELO 與段位分級
        opp_ids = [
            uid
            for uid in ((m.team_b_p1_id, m.team_b_p2_id) if in_a else (m.team_a_p1_id, m.team_a_p2_id))
            if uid is not None
        ]
        opp_mmrs = [float(users_map[uid].global_mmr) for uid in opp_ids if uid in users_map]
        if opp_mmrs:
            avg_opp_mmr = sum(opp_mmrs) / len(opp_mmrs)
            t_key = _tier_for_mmr(avg_opp_mmr)
            tb = tier_buckets[t_key]
            tb["matches"] += 1
            if i_won:
                tb["wins"] += 1
            else:
                tb["losses"] += 1

            if avg_opp_mmr > user_mmr + 1e-6:
                giant_matches += 1
                if i_won:
                    giant_wins += 1

        # 出勤週期統計
        m_dt = ensure_utc(m.created_at)
        if m_dt is not None:
            m_tw = m_dt.astimezone(TW_TZ)
            m_monday = (m_tw - timedelta(days=m_tw.weekday())).strftime("%Y-%m-%d")
            if m_monday in week_map:
                week_map[m_monday]["matches"] += 1
                if i_won:
                    week_map[m_monday]["wins"] += 1

    # 計算五維雷達指標 (0..100)
    s_total = singles["matches"]
    s_wins = singles["wins"]
    s_losses = singles["losses"]
    s_wr = round((s_wins / s_total) * 100) if s_total > 0 else 0
    s_score = _bayesian_score(s_wins, s_total)

    d_total = doubles["matches"]
    d_wins = doubles["wins"]
    d_losses = doubles["losses"]
    d_wr = round((d_wins / d_total) * 100) if d_total > 0 else 0
    d_score = _bayesian_score(d_wins, d_total)

    total_sets = my_sets_total + opp_sets_total
    set_wr = round((my_sets_total / total_sets) * 100) if total_sets > 0 else 50
    sweep_ratio = (sweep_win / settled_count) if settled_count > 0 else 0.3
    dom_raw = (set_wr * 0.65) + (sweep_ratio * 100.0 * 0.35)
    if settled_count == 0:
        dom_score = 50
    else:
        # 少量樣本時溫和向 50 收斂
        weight = min(1.0, settled_count / 6.0)
        dom_score = max(18, min(99, round(dom_raw * weight + 50.0 * (1.0 - weight))))

    clutch_losses = clutch_matches - clutch_wins
    clutch_score = _bayesian_score(clutch_wins, clutch_matches, prior_weight=2.5)

    giant_losses = giant_matches - giant_wins
    if giant_matches > 0:
        gs_score = _bayesian_score(giant_wins, giant_matches, prior_weight=2.5, prior_mean=0.45)
        gs_detail = f"高分對手 {giant_wins}勝{giant_losses}敗"
    else:
        gs_score = 50
        gs_detail = "尚無挑戰高分紀錄"

    radar = [
        {
            "key": "singles",
            "label": "單打實力",
            "score": s_score,
            "detail": f"{s_wins}勝{s_losses}敗 ({s_wr}%)" if s_total > 0 else "尚無單打紀錄",
            "sample": s_total,
        },
        {
            "key": "doubles",
            "label": "雙打默契",
            "score": d_score,
            "detail": f"{d_wins}勝{d_losses}敗 ({d_wr}%)" if d_total > 0 else "尚無雙打紀錄",
            "sample": d_total,
        },
        {
            "key": "dominance",
            "label": "完封壓制",
            "score": dom_score,
            "detail": f"完封 {sweep_win} 場 · 局勝率 {set_wr}%" if settled_count > 0 else "尚無對戰紀錄",
            "sample": settled_count,
        },
        {
            "key": "clutch",
            "label": "決勝心臟",
            "score": clutch_score,
            "detail": f"決勝局 {clutch_wins}勝{clutch_losses}敗" if clutch_matches > 0 else "尚無決勝局",
            "sample": clutch_matches,
        },
        {
            "key": "giant_slayer",
            "label": "強敵抗衡",
            "score": gs_score,
            "detail": gs_detail,
            "sample": giant_matches,
        },
    ]

    # 推導個人專屬稱號
    sampled_axes = [ax for ax in radar if ax["sample"] > 0]
    strongest_axis = max(sampled_axes, key=lambda a: (a["score"], a["sample"])) if sampled_axes else radar[0]
    weakest_axis = min(sampled_axes, key=lambda a: (a["score"], -a["sample"])) if sampled_axes else radar[1]

    if not unlocked:
        archetype = {
            "title": "定級探索新星",
            "tagline": f"再完成 {unlock_required - settled_count} 場已結算對戰即可解鎖個人五維球風稱號",
            "badge_tone": "blue",
            "strength_label": strongest_axis["label"] if sampled_axes else "等待實戰累積",
            "focus_label": "完成 5 場定級賽",
        }
    elif clutch_matches >= 2 and clutch_score >= 64 and clutch_score >= strongest_axis["score"] - 4:
        archetype = {
            "title": "決勝局大心臟",
            "tagline": "打到決勝局反而越沉著冷靜，關鍵時刻得分把握度極高",
            "badge_tone": "amber",
            "strength_label": "決勝心臟",
            "focus_label": weakest_axis["label"],
        }
    elif giant_matches >= 2 and gs_score >= 58 and gs_score >= strongest_axis["score"] - 5:
        archetype = {
            "title": "巨人殺手",
            "tagline": "遇強則強的抗壓型選手，擅長上演爆冷逆襲好戲",
            "badge_tone": "rose",
            "strength_label": "強敵抗衡",
            "focus_label": weakest_axis["label"],
        }
    elif sweep_win >= 3 and dom_score >= 66:
        archetype = {
            "title": "直落完封機器",
            "tagline": "開局搶攻節奏犀利，經常不給對手翻盤機會直接橫掃收官",
            "badge_tone": "emerald",
            "strength_label": "完封壓制",
            "focus_label": weakest_axis["label"],
        }
    elif d_total >= 2 and d_score - s_score >= 10:
        archetype = {
            "title": "雙打戰術核心",
            "tagline": "善於跑位補位與帶動搭檔節奏，雙打場上的穩定推進器",
            "badge_tone": "blue",
            "strength_label": "雙打默契",
            "focus_label": weakest_axis["label"],
        }
    elif s_total >= 2 and s_score - d_score >= 10:
        archetype = {
            "title": "孤膽單打戰神",
            "tagline": "一對一正面拆招極具威脅，靠個人技術主導戰局",
            "badge_tone": "violet",
            "strength_label": "單打實力",
            "focus_label": weakest_axis["label"],
        }
    else:
        archetype = {
            "title": "全能六邊形戰士",
            "tagline": "單雙打與抗壓能力全面均衡，場上節奏收放自如的實力派",
            "badge_tone": "emerald",
            "strength_label": strongest_axis["label"],
            "focus_label": weakest_axis["label"],
        }

    def _pct(cnt: int) -> int:
        return round((cnt / settled_count) * 100) if settled_count > 0 else 0

    vs_tiers = []
    for key in ("elite", "gold", "silver", "bronze"):
        tb = tier_buckets[key]
        m_cnt = tb["matches"]
        vs_tiers.append({
            **tb,
            "win_rate": round((tb["wins"] / m_cnt) * 100) if m_cnt > 0 else 0,
        })

    activity_weeks = [week_map[ws.strftime("%Y-%m-%d")] for ws in week_starts]
    activity_8w_total = sum(w["matches"] for w in activity_weeks)

    return {
        "unlocked": unlocked,
        "settled_count": settled_count,
        "unlock_required": unlock_required,
        "radar": radar,
        "archetype": archetype,
        "breakdown": {
            "singles": {
                "matches": s_total,
                "wins": s_wins,
                "losses": s_losses,
                "win_rate": s_wr,
                "net_mmr": round(singles["net_mmr"], 1),
            },
            "doubles": {
                "matches": d_total,
                "wins": d_wins,
                "losses": d_losses,
                "win_rate": d_wr,
                "net_mmr": round(doubles["net_mmr"], 1),
            },
            "scorelines": {
                "total": settled_count,
                "sweep_win": {"count": sweep_win, "pct": _pct(sweep_win)},
                "close_win": {"count": close_win, "pct": _pct(close_win)},
                "close_loss": {"count": close_loss, "pct": _pct(close_loss)},
                "sweep_loss": {"count": sweep_loss, "pct": _pct(sweep_loss)},
            },
            "vs_tiers": vs_tiers,
            "activity_weeks": activity_weeks,
            "activity_8w_total": activity_8w_total,
        },
    }
