import math

# ==========================================
# ⚙️ 集中式調參配置 (Centralized Configuration)
# ==========================================
ELO_CONFIG = {
    "DEFAULT_BASE_MMR": 1000.0,
    "MIN_MMR_FLOOR": 600.0,
    "SEASON_PLACEMENT_MATCHES": 5,      # 每季前 5 場為定級賽
    "K_PLACEMENT": 32,                  # 定級賽期間 (season_matches < 5)
    "K_NORMAL": 24,                     # 完成定級後 (season_matches >= 5)
    "TEAM_WEIGHT_HIGH": 0.5,            # 雙打隊伍戰力採真實平均 (50/50)
    "TEAM_WEIGHT_LOW": 0.5,
    "DOUBLES_PLAYER_MULTIPLIER": 0.85,  # 雙打個人變動為單打之 0.85 倍（同隊均分）
}


def get_k_factor(matches_played: int) -> int:
    """
    決定波動率 K 值（依本季出賽場次）：
    每季前 5 場定級賽採用 K=32 加速校正定位；完成定級後（第 6 場起）恢復常態 K=24。
    """
    if matches_played < ELO_CONFIG["SEASON_PLACEMENT_MATCHES"]:
        return ELO_CONFIG["K_PLACEMENT"]
    return ELO_CONFIG["K_NORMAL"]


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
    同隊共擔雙打積分 (Equal 50/50 Split)：
    將團隊總變動值平分給兩位搭檔，避免輸球時反比例懲罰低分隊友。
    """
    del player_a_mmr, player_b_mmr
    half = round(team_delta * 0.5, 1)
    return half, half


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
    每位選手各自套用自身當季出賽數對應的 K 值（前 5 場定級賽 K=32，第 6 場起 K=24），
    不與對手互相平均；雙打則兩位搭檔採真實均強 (50/50) 與 0.85 倍個人變動係數。

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

    # 2. 計算勝率期望值與賽制淨勝局加成
    expected_win_rate = 1 / (1 + 10 ** ((loser_team_mmr - winner_team_mmr) / 400))
    surprise_factor = 1 - expected_win_rate
    mov = get_mov_multiplier(score_winner, score_loser, format)

    # 3. 取得各選手獨立 K 值（不再與對手平均）
    k_win_p1 = get_k_factor(winner_p1_matches)
    k_lose_p1 = get_k_factor(loser_p1_matches)

    # 4. 依賽制派發個人積分
    floor = ELO_CONFIG["MIN_MMR_FLOOR"]

    if not is_doubles:
        # ── 單打 ──────────────────────────────────────
        winner_p1_delta = round(k_win_p1 * surprise_factor * mov, 1)
        loser_p1_delta = -round(k_lose_p1 * surprise_factor * mov, 1)

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
        # ── 雙打 (同隊 0.85x 均分共擔) ─────────────────
        k_win_p2 = get_k_factor(winner_p2_matches) if winner_p2_matches is not None else k_win_p1
        k_lose_p2 = get_k_factor(loser_p2_matches) if loser_p2_matches is not None else k_lose_p1
        mult = ELO_CONFIG["DOUBLES_PLAYER_MULTIPLIER"]

        winner_p1_delta = round(k_win_p1 * surprise_factor * mov * mult, 1)
        winner_p2_delta = round(k_win_p2 * surprise_factor * mov * mult, 1)
        loser_p1_raw = -round(k_lose_p1 * surprise_factor * mov * mult, 1)
        loser_p2_raw = -round(k_lose_p2 * surprise_factor * mov * mult, 1)

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
    print("情境 A: 單打爆冷 — 林專員 (1000, 當季第3場 K=32) 2:1 勝 王科長 (1320, 已定級 K=24)")
    print("=" * 60)
    result_a = calculate_match_deltas(
        team_winner_p1_mmr=1000.0,
        team_winner_p2_mmr=None,
        team_loser_p1_mmr=1320.0,
        team_loser_p2_mmr=None,
        winner_p1_matches=2,
        winner_p2_matches=None,
        loser_p1_matches=8,
        loser_p2_matches=None,
        score_winner=2,
        score_loser=1,
        format="BO3",
    )
    print(f"  林專員獲得: +{result_a['winner_p1_delta']} MMR (K=32)")
    print(f"  王科長損失:  {result_a['loser_p1_delta']} MMR (K=24)\n")

    # ── 情境 B: 雙打 — 已定級強弱搭檔同隊均分 (0.85x) ──────────────────────
    print("=" * 60)
    print("情境 B: 雙打 — (1320 + 1000) 獲勝 vs (1160 + 1160)")
    print("  預期：同隊皆已定級 (K=24) 時，強弱搭檔同加同扣")
    print("=" * 60)
    result_b = calculate_match_deltas(
        team_winner_p1_mmr=1320.0,
        team_winner_p2_mmr=1000.0,
        team_loser_p1_mmr=1160.0,
        team_loser_p2_mmr=1160.0,
        winner_p1_matches=10,
        winner_p2_matches=10,
        loser_p1_matches=10,
        loser_p2_matches=10,
        score_winner=2,
        score_loser=0,
        format="BO3",
    )
    print(f"  勝方 1320 MMR 獲得: +{result_b['winner_p1_delta']} MMR")
    print(f"  勝方 1000 MMR 獲得: +{result_b['winner_p2_delta']} MMR  <- 應與搭檔相同")
    print(f"  敗方 1160 MMR(p1) 損失:  {result_b['loser_p1_delta']} MMR")
    print(f"  敗方 1160 MMR(p2) 損失:  {result_b['loser_p2_delta']} MMR\n")