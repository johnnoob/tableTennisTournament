import math

# ==========================================
# ⚙️ 集中式調參配置 (Centralized Configuration)
# ==========================================
ELO_CONFIG = {
    "DEFAULT_BASE_MMR": 1000.0,
    "MIN_MMR_FLOOR": 600.0,
    "K_PLACEMENT": 40,          # matches < 10
    "K_NORMAL": 24,             # matches 10 ~ 29
    "K_VETERAN": 16,            # matches >= 30
    "TEAM_WEIGHT_HIGH": 0.6,
    "TEAM_WEIGHT_LOW": 0.4,
    "DOUBLES_DELTA_DISCOUNT": 1.2,  # multiplier for doubles matches
}


def get_k_factor(matches_played: int) -> int:
    """
    決定波動率 K 值。
    新手前 10 場波動最大，幫助快速定級；老手則相對穩定。
    """
    if matches_played < ELO_CONFIG["K_PLACEMENT"] // 4:  # < 10
        return ELO_CONFIG["K_PLACEMENT"]
    elif matches_played < 30:
        return ELO_CONFIG["K_NORMAL"]
    else:
        return ELO_CONFIG["K_VETERAN"]


def get_team_mmr(mmr1: float, mmr2: float = None) -> float:
    """
    計算隊伍綜合 MMR。
    如果是單打，直接回傳 mmr1。
    如果是雙打，套用「強者權重 (60/40)」公式。
    """
    if mmr2 is None:
        return mmr1

    high_mmr = max(mmr1, mmr2)
    low_mmr = min(mmr1, mmr2)

    return (high_mmr * ELO_CONFIG["TEAM_WEIGHT_HIGH"]) + (low_mmr * ELO_CONFIG["TEAM_WEIGHT_LOW"])


def get_mov_multiplier(score_winner: int, score_loser: int, format: str = "BO3") -> float:
    """
    取得賽制與完封加成乘數。
    BO5 因為消耗時間與體力較多，整體獲得的分數乘數會高於 BO3。
    """
    margin = abs(score_winner - score_loser)

    if format == "BO3":
        if margin >= 2: return 1.2  # 2:0 完封 (高效輾壓)
        return 1.0                  # 2:1 險勝 (基準線)

    elif format == "BO5":
        if margin >= 3: return 1.5  # 3:0 絕對宰制 (最高加成)
        if margin == 2: return 1.35 # 3:1 穩健獲勝
        return 1.2                  # 3:2 苦戰五局

    return 1.0  # 預設防呆


def distribute_doubles_delta(
    player_a_mmr: float,
    player_b_mmr: float,
    team_delta: float,
) -> tuple[float, float]:
    """
    反比例分配雙打積分 (Inverse-Ratio Distribution)。
    MMR 較低的玩家獲得更多正分（保護弱者）；
    MMR 較高的玩家獲得較少正分（要求強者帶隊責任）。
    對於負分，MMR 較高者扣較少（保護強者），MMR 較低者扣較多。

    Logic:
        weight_a = player_b_mmr / (player_a_mmr + player_b_mmr)
        weight_b = player_a_mmr / (player_a_mmr + player_b_mmr)
    """
    total = player_a_mmr + player_b_mmr
    weight_a = player_b_mmr / total
    weight_b = player_a_mmr / total

    delta_a = round(team_delta * weight_a, 1)
    delta_b = round(team_delta * weight_b, 1)

    return delta_a, delta_b


def calculate_match_deltas(
    team_winner_p1_mmr: float,
    team_winner_p2_mmr: float | None,
    team_loser_p1_mmr: float,
    team_loser_p2_mmr: float | None,
    winner_p1_matches: int,
    winner_p2_matches: int | None,
    loser_p1_matches: int,
    loser_p2_matches: int | None,
    score_winner: int,
    score_loser: int,
    format: str = "BO3",
) -> dict:
    """
    主計算函式：處理單打與雙打，回傳每位參與者的精確積分變動。

    Returns:
        {
            "winner_p1_delta": float,
            "winner_p2_delta": float,  # 0.0 if singles
            "loser_p1_delta": float,
            "loser_p2_delta": float,   # 0.0 if singles
        }
    """
    is_doubles = team_winner_p2_mmr is not None

    # 1. 計算隊伍綜合 MMR
    winner_team_mmr = get_team_mmr(team_winner_p1_mmr, team_winner_p2_mmr)
    loser_team_mmr = get_team_mmr(team_loser_p1_mmr, team_loser_p2_mmr)

    # 2. 計算勝率期望值
    expected_win_rate = 1 / (1 + 10 ** ((loser_team_mmr - winner_team_mmr) / 400))

    # 3. 動態 K 值 & MoV 乘數
    k_win_p1 = get_k_factor(winner_p1_matches)
    k_lose_p1 = get_k_factor(loser_p1_matches)

    if is_doubles:
        k_win_p2 = get_k_factor(winner_p2_matches) if winner_p2_matches is not None else k_win_p1
        k_lose_p2 = get_k_factor(loser_p2_matches) if loser_p2_matches is not None else k_lose_p1
        match_k = (k_win_p1 + k_win_p2 + k_lose_p1 + k_lose_p2) / 4
    else:
        match_k = (k_win_p1 + k_lose_p1) / 2

    mov = get_mov_multiplier(score_winner, score_loser, format)

    # 4. 基礎隊伍積分變動
    team_delta = match_k * (1 - expected_win_rate) * mov

    # 5. 依賽制派發個人積分
    floor = ELO_CONFIG["MIN_MMR_FLOOR"]

    if not is_doubles:
        # ── 單打 ──────────────────────────────────────
        winner_p1_delta = round(team_delta, 1)
        loser_p1_delta = -winner_p1_delta

        # Floor 保護
        if team_loser_p1_mmr + loser_p1_delta < floor:
            loser_p1_delta = round(floor - team_loser_p1_mmr, 1)

        return {
            "winner_p1_delta": winner_p1_delta,
            "winner_p2_delta": 0.0,
            "loser_p1_delta": loser_p1_delta,
            "loser_p2_delta": 0.0,
        }

    else:
        # ── 雙打 ──────────────────────────────────────
        discounted_delta = team_delta * ELO_CONFIG["DOUBLES_DELTA_DISCOUNT"]

        # 勝方分配
        winner_p1_delta, winner_p2_delta = distribute_doubles_delta(
            team_winner_p1_mmr, team_winner_p2_mmr, discounted_delta
        )
        # 敗方分配（負值）
        loser_p1_raw, loser_p2_raw = distribute_doubles_delta(
            team_loser_p1_mmr, team_loser_p2_mmr, -discounted_delta
        )

        # Floor 保護：確保不低於最低 MMR
        if team_loser_p1_mmr + loser_p1_raw < floor:
            loser_p1_raw = round(floor - team_loser_p1_mmr, 1)
        if team_loser_p2_mmr + loser_p2_raw < floor:
            loser_p2_raw = round(floor - team_loser_p2_mmr, 1)

        return {
            "winner_p1_delta": winner_p1_delta,
            "winner_p2_delta": winner_p2_delta,
            "loser_p1_delta": loser_p1_raw,
            "loser_p2_delta": loser_p2_raw,
        }


# ==========================================
# 🧪 測試沙盒 (可以直接執行這個檔案看看結果)
# ==========================================
if __name__ == "__main__":
    # ── 情境 A: 單打爆冷 (Upset) ──────────────────────────────────────────────
    print("=" * 60)
    print("情境 A: 單打爆冷 — 林專員 (1000) 2:1 險勝 王科長 (1500)")
    print("=" * 60)
    result_a = calculate_match_deltas(
        team_winner_p1_mmr=1000.0,
        team_winner_p2_mmr=None,
        team_loser_p1_mmr=1500.0,
        team_loser_p2_mmr=None,
        winner_p1_matches=5,
        winner_p2_matches=None,
        loser_p1_matches=50,
        loser_p2_matches=None,
        score_winner=2,
        score_loser=1,
        format="BO3",
    )
    print(f"  林專員獲得: +{result_a['winner_p1_delta']} MMR")
    print(f"  王科長損失:  {result_a['loser_p1_delta']} MMR\n")

    # ── 情境 B: 雙打 — 強弱湭檔獲勝 ───────────────────────────────────
    print("=" * 60)
    print("情境 B: 雙打 — (1500 + 1000) 獲勝 vs (1200 + 1200)")
    print("  預期：1000 MMR 球員應獲得較高正分")
    print("=" * 60)
    result_b = calculate_match_deltas(
        team_winner_p1_mmr=1500.0,
        team_winner_p2_mmr=1000.0,
        team_loser_p1_mmr=1200.0,
        team_loser_p2_mmr=1200.0,
        winner_p1_matches=35,
        winner_p2_matches=3,
        loser_p1_matches=20,
        loser_p2_matches=20,
        score_winner=2,
        score_loser=0,
        format="BO3",
    )
    print(f"  勝方 1500 MMR 獲得: +{result_b['winner_p1_delta']} MMR")
    print(f"  勝方 1000 MMR 獲得: +{result_b['winner_p2_delta']} MMR  <- 應較高")
    print(f"  敗方 1200 MMR(p1) 損失:  {result_b['loser_p1_delta']} MMR")
    print(f"  敗方 1200 MMR(p2) 損失:  {result_b['loser_p2_delta']} MMR\n")

    # ── 情境 C: 相同雙打組合 — 失敗，驗證強者保護 ────────────────────
    print("=" * 60)
    print("情境 C: 雙打 — (1500 + 1000) 落敗 vs (1200 + 1200)")
    print("  預期：1500 MMR 球員應扣較少（保護強者）")
    print("=" * 60)
    result_c = calculate_match_deltas(
        team_winner_p1_mmr=1200.0,
        team_winner_p2_mmr=1200.0,
        team_loser_p1_mmr=1500.0,
        team_loser_p2_mmr=1000.0,
        winner_p1_matches=20,
        winner_p2_matches=20,
        loser_p1_matches=35,
        loser_p2_matches=3,
        score_winner=2,
        score_loser=1,
        format="BO3",
    )
    print(f"  勝方 1200 MMR(p1) 獲得: +{result_c['winner_p1_delta']} MMR")
    print(f"  勝方 1200 MMR(p2) 獲得: +{result_c['winner_p2_delta']} MMR")
    print(f"  敗方 1500 MMR 損失:  {result_c['loser_p1_delta']} MMR  <- 應較少")
    print(f"  敗方 1000 MMR 損失:  {result_c['loser_p2_delta']} MMR  <- 應較多")