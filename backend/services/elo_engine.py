import math

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
    
    return (high_mmr * 0.6) + (low_mmr * 0.4)

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
        # BO5 體力與時間加成
        if margin >= 3: return 1.5  # 3:0 絕對宰制 (最高加成)
        if margin == 2: return 1.35 # 3:1 穩健獲勝
        return 1.2                  # 3:2 苦戰五局 (等同於 BO3 的完封)
        
    return 1.0 # 預設防呆

def get_k_factor(matches_played: int) -> int:
    """
    決定波動率 K 值。
    新手前 10 場波動最大，幫助快速定級；老手則相對穩定。
    """
    if matches_played < 10:
        return 40  # 定級期
    elif matches_played < 30:
        return 24  # 成長期
    else:
        return 16  # 穩定老手

def calculate_elo_delta(winner_team_mmr: float, loser_team_mmr: float, 
                        winner_matches_played: int, score_winner: int, 
                        score_loser: int, format: str = "BO3") -> float:
    """
    核心：計算贏家該加多少分 (敗家就扣多少分)。
    """
    # 1. 計算勝率期望值 (Elo 核心公式)
    expected_win_rate = 1 / (1 + 10 ** ((loser_team_mmr - winner_team_mmr) / 400))
    
    # 2. 取得動態 K 值與完封乘數
    k = get_k_factor(winner_matches_played)
    mov = get_mov_multiplier(score_winner, score_loser, format)
    
    # 3. 計算最終分數變動 (實際勝果為 1)
    # 公式：K * (實際結果 - 預期結果) * 完封加成
    delta = k * (1 - expected_win_rate) * mov
    
    # 四捨五入到小數點第一位，例如 15.2
    return round(delta, 1)

# ==========================================
# 🧪 測試沙盒 (可以直接執行這個檔案看看結果)
# ==========================================
if __name__ == "__main__":
    print("--- 測試情境 A: 王科長 (1600) 完封 林專員 (1200) ---")
    delta = calculate_elo_delta(1600, 1200, 35, 2, 0, "BO3")
    print(f"強打弱符合預期，且是老手，王科長只賺了 {delta} 分 (林專員扣 {delta} 分)\n")

    print("--- 測試情境 B: 林專員 (1200) 爆冷 2:1 險勝 王科長 (1600) ---")
    delta_upset = calculate_elo_delta(1200, 1600, 35, 2, 1, "BO3")
    print(f"大爆冷門！林專員狂賺了 {delta_upset} 分 (王科長慘扣 {delta_upset} 分)\n")
    
    print("--- 測試情境 C: 雙打測試 ---")
    team_a = get_team_mmr(1600, 1000) # 高手帶菜鳥
    team_b = get_team_mmr(1300, 1300) # 實力平均組合
    print(f"高手帶菜鳥隊伍 MMR: {team_a}")
    print(f"實力平均隊伍 MMR: {team_b}")