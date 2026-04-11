# backend/seed.py
# 🌟 完整版假資料種植腳本 — 含真實球員、比賽紀錄、積分歷史
import sys, os, random, math
from datetime import datetime, timedelta
from uuid import uuid4

# 確保可以引用同目錄模組
_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else os.getcwd()
sys.path.insert(0, _dir)

from sqlmodel import Session, SQLModel
from database import engine, create_db_and_tables
from models import User, Season, SeasonRecord, PlayerStatHistory, Match, MatchParticipation, Notification, SystemConfig, Announcement, SeasonPrize, TournamentEvent, TournamentParticipant
from services.elo_engine import calculate_match_deltas

random.seed(42)  # 固定隨機種子，確保每次執行結果一致

# ==========================================
# 1. 球員基礎資料 (與前端 mockData 對齊)
# ==========================================
PLAYERS_DATA = [
    {
        "name": "陳大文", "email": "nova@agency.gov.tw",
        "department": "資訊部 / 技術處", "gender": "男",
        "dominant_hand": "右手", "rubber_forehand": "平面-澀性膠皮", "rubber_backhand": "長顆粒",
        "global_mmr": 1650.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop",
    },
    {
        "name": "林怡君", "email": "kevin.lin@agency.gov.tw",
        "department": "秘書處 / 第一組", "gender": "男",
        "dominant_hand": "右手", "rubber_forehand": "平面－澀性膠皮", "rubber_backhand": "平面－黏性膠皮",
        "global_mmr": 1900.0, "role": "admin",
        "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    },
    {
        "name": "陳偉安", "email": "sarah.chen@agency.gov.tw",
        "department": "資訊部 / 技術處", "gender": "女",
        "dominant_hand": "右手", "rubber_forehand": "平面－黏性膠皮", "rubber_backhand": "平面－澀性膠皮",
        "global_mmr": 1780.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    },
    {
        "name": "黃柏翰", "email": "jason.huang@agency.gov.tw",
        "department": "法務部 / 營運組", "gender": "男",
        "dominant_hand": "右手", "rubber_forehand": "平面－澀性膠皮", "rubber_backhand": "長顆粒",
        "global_mmr": 1620.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    },
    {
        "name": "王小明", "email": "emily.wang@agency.gov.tw",
        "department": "研發中心 / 第二開發課", "gender": "男",
        "dominant_hand": "左手", "rubber_forehand": "平面－澀性膠皮", "rubber_backhand": "平面－澀性膠皮",
        "global_mmr": 1550.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    },
    {
        "name": "李國華", "email": "mike.lee@agency.gov.tw",
        "department": "總務處 / 資產管理", "gender": "男",
        "dominant_hand": "右手", "rubber_forehand": "短顆粒", "rubber_backhand": "平面－澀性膠皮",
        "global_mmr": 1480.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    },
    {
        "name": "張雅婷", "email": "tina.chang@agency.gov.tw",
        "department": "人事室 / 培訓組", "gender": "女",
        "dominant_hand": "右手", "rubber_forehand": "平面－澀性膠皮", "rubber_backhand": "平面－澀性膠皮",
        "global_mmr": 1420.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop",
    },
    {
        "name": "趙雲", "email": "cloud.zhao@agency.gov.tw",
        "department": "戰略規劃部 / 前瞻組", "gender": "男",
        "dominant_hand": "右手", "rubber_forehand": "平面－黏性膠皮", "rubber_backhand": "平面－黏性膠皮",
        "global_mmr": 1350.0, "role": "user",
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    },
]

def decide_winner(mmr_a: float, mmr_b: float) -> bool:
    """根據 MMR 差距決定 A 是否獲勝 (模擬真實概率)"""
    prob_a_wins = 1 / (1 + 10 ** ((mmr_b - mmr_a) / 400))
    return random.random() < prob_a_wins

def random_score(winner_first: bool, fmt: str = "BO3") -> tuple[int, int]:
    """生成隨機比分"""
    if fmt == "BO3":
        if random.random() < 0.4:
            return (2, 0) if winner_first else (0, 2)
        else:
            return (2, 1) if winner_first else (1, 2)
    else:  # BO5
        r = random.random()
        if r < 0.25:
            return (3, 0) if winner_first else (0, 3)
        elif r < 0.55:
            return (3, 1) if winner_first else (1, 3)
        else:
            return (3, 2) if winner_first else (2, 3)

def seed_data():
    print("--- 正在清除舊有資料並重建資料表... ---")
    SQLModel.metadata.drop_all(engine)
    create_db_and_tables()

    with Session(engine) as session:
        print("--- 開始種植完整假資料... ---\n")

        # ==========================================
        # 1. System Configs, Announcements, Tournaments
        # ==========================================
        print("--- 設定系統參數與公告... ---")
        sys_pause = SystemConfig(key="season_paused", value="false", description="是否暫停積分賽")
        sys_interval = SystemConfig(key="season_interval_months", value="3", description="積分賽自動生成的間隔月份(1-12)")
        sys_start = SystemConfig(key="season_start_date", value="2026-01-01T00:00:00", description="首個賽季的基準起始時間")
        sys_decay_days = SystemConfig(key="decay_days_threshold", value="21", description="惰性衰退天數閾值")
        sys_decay_amount = SystemConfig(key="decay_amount", value="5.0", description="每次衰退扣除的評分金額")
        session.add_all([sys_pause, sys_interval, sys_start, sys_decay_days, sys_decay_amount])

        ann1 = Announcement(
            title="S4 企業盃桌球賽報名開跑！",
            content="今年的桌球賽即將開打，各單位好手千萬別錯過！",
            link_text="前往報名",
            link_url="https://challonge.com/xxxyyy",
            is_active=True
        )
        ann2 = Announcement(
            title="系統升級預告",
            content="為了更好的體驗，我們即將上線「名人堂」與「獨立錦標賽」功能，敬請期待！",
        )
        session.add_all([ann1, ann2])

        tourn = TournamentEvent(
            title="2026 秋季跨部門友誼賽",
            image_url="https://images.unsplash.com/photo-1511067007398-7e4b90cfa4bc?w=800&q=80",
            status="registering",
            rules="https://challonge.com/friendship2026"
        )
        session.add(tourn)

        # ==========================================
        # 1.5 建立賽季
        # ==========================================
        season = Season(
            id="2026-S1",
            name="2026 春季例行賽",
            status="active",
            start_date=datetime(2026, 1, 6)
        )
        session.add(season)
        print("OK - 賽季建立完成: 2026 春季例行賽")

        prize1 = SeasonPrize(season_id=season.id, rank=1, item_name="BTY-Viscaria (限量版)", quantity=1)
        prize2 = SeasonPrize(season_id=season.id, rank=2, item_name="Nittaku 3星比賽球 (整盒)", quantity=1)
        prize3 = SeasonPrize(season_id=season.id, rank=3, item_name="高級運動毛巾", quantity=2)
        session.add_all([prize1, prize2, prize3])


        # ==========================================
        # 2. 建立所有球員
        # ==========================================
        users = []
        for pd in PLAYERS_DATA:
            user = User(
                email=pd["email"],
                name=pd["name"],
                department=pd["department"],
                gender=pd["gender"],
                dominant_hand=pd["dominant_hand"],
                rubber_forehand=pd["rubber_forehand"],
                rubber_backhand=pd["rubber_backhand"],
                global_mmr=pd["global_mmr"],
                role=pd["role"],
                avatar_url=pd["avatar_url"],
                auth_provider="local",
            )
            session.add(user)
            users.append(user)

        session.commit()
        for u in users:
            session.refresh(u)

        print(f"OK - 已建立 {len(users)} 位球員:")
        for u in users:
            print(f"   * {u.name} ({u.department}) - MMR: {u.global_mmr}")

        # ==========================================
        # 3. 為每位球員建立賽季紀錄 (空白，稍後由模擬比賽填入)
        # ==========================================
        season_records = {}
        for i, u in enumerate(users):
            # 預設 previous_rank 用初始排名
            sr = SeasonRecord(
                user_id=u.id,
                season_id=season.id,
                matches_played=0,
                wins=0,
                previous_rank=i + 1
            )
            session.add(sr)
            season_records[u.id] = sr

        session.commit()
        for sr in season_records.values():
            session.refresh(sr)
        print("OK - 賽季初始戰績建立完成")

        # ==========================================
        # 4. 🎮 模擬大量比賽 (核心！)
        # ==========================================
        # 從 1/6 至 4/3，約 88 天，每天 1~3 場比賽
        start_date = datetime(2026, 1, 6, 12, 0, 0)
        current_time = start_date
        end_date = datetime(2026, 4, 3, 17, 0, 0)

        match_count = 0
        singles_count = 0
        doubles_count = 0

        # 初始化追蹤陣列 (用於製作初始快照)
        initial_histories = []
        for u in users:
            h = PlayerStatHistory(
                user_id=u.id,
                mmr=u.global_mmr,
                recorded_at=start_date - timedelta(hours=1)
            )
            initial_histories.append(h)
        session.add_all(initial_histories)

        print("\n--- 開始模擬比賽... ---")

        while current_time < end_date:
            # 每天 1~3 場比賽
            daily_matches = random.randint(1, 3)

            for _ in range(daily_matches):
                # 隨機決定比賽類型 (70% 單打, 30% 雙打)
                is_doubles = random.random() < 0.30

                if is_doubles and len(users) >= 4:
                    # 🤝 雙打：隨機選四人
                    selected = random.sample(users, 4)
                    team_a = selected[:2]
                    team_b = selected[2:]
                    match_type = "doubles"
                    fmt = random.choice(["BO3", "BO3", "BO5"])  # BO5 較少

                    mmr_a = (team_a[0].global_mmr * 0.6 + team_a[1].global_mmr * 0.4)
                    mmr_b = (team_b[0].global_mmr * 0.6 + team_b[1].global_mmr * 0.4)
                else:
                    # ⚔️ 單打：隨機選兩人
                    selected = random.sample(users, 2)
                    team_a = [selected[0]]
                    team_b = [selected[1]]
                    match_type = "singles"
                    fmt = random.choice(["BO3", "BO3", "BO3", "BO5"])

                    mmr_a = team_a[0].global_mmr
                    mmr_b = team_b[0].global_mmr

                # 決定勝負
                a_wins = decide_winner(mmr_a, mmr_b)
                score_a, score_b = random_score(a_wins, fmt)

                # 用 Elo 引擎算分
                winner_team = team_a if a_wins else team_b
                loser_team = team_b if a_wins else team_a
                deltas = calculate_match_deltas(
                    team_winner_p1_mmr=mmr_a if a_wins else mmr_b,
                    team_winner_p2_mmr=winner_team[1].global_mmr if is_doubles else None,
                    team_loser_p1_mmr=mmr_b if a_wins else mmr_a,
                    team_loser_p2_mmr=loser_team[1].global_mmr if is_doubles else None,
                    winner_p1_matches=season_records[winner_team[0].id].matches_played,
                    winner_p2_matches=season_records[winner_team[1].id].matches_played if is_doubles else None,
                    loser_p1_matches=season_records[loser_team[0].id].matches_played,
                    loser_p2_matches=season_records[loser_team[1].id].matches_played if is_doubles else None,
                    score_winner=max(score_a, score_b),
                    score_loser=min(score_a, score_b),
                    format=fmt
                )
                delta = deltas["winner_p1_delta"]

                # 隨機偏移比賽時間 (1~6 小時)
                match_time = current_time + timedelta(
                    hours=random.randint(0, 5),
                    minutes=random.randint(0, 59)
                )

                # 建立 Match 紀錄
                match = Match(
                    match_type=match_type,
                    format=fmt,
                    team_a_p1_id=team_a[0].id,
                    team_a_p2_id=team_a[1].id if len(team_a) > 1 else None,
                    team_b_p1_id=team_b[0].id,
                    team_b_p2_id=team_b[1].id if len(team_b) > 1 else None,
                    score_a=score_a,
                    score_b=score_b,
                    mmr_exchanged=delta,
                    status="confirmed",
                    reported_by=team_a[0].id,
                    season_id=season.id,
                    created_at=match_time,
                )
                session.add(match)
                session.flush()

                # 更新每位球員的數據
                all_players_in_match = [(p, "A", a_wins) for p in team_a] + [(p, "B", not a_wins) for p in team_b]

                for player, team_name, is_winner in all_players_in_match:
                    actual_delta = delta if is_winner else -delta

                    # 更新 MMR
                    player.global_mmr += actual_delta
                    session.add(player)

                    # 更新賽季紀錄
                    sr = season_records[player.id]
                    sr.matches_played += 1
                    if is_winner:
                        sr.wins += 1
                    session.add(sr)

                    # 建立歷史快照 (每場比賽後)
                    history = PlayerStatHistory(
                        user_id=player.id,
                        mmr=player.global_mmr,
                        recorded_at=match_time + timedelta(seconds=30),
                    )
                    session.add(history)

                    # 建立參與紀錄 (天敵/搭檔分析用)
                    participation = MatchParticipation(
                        match_id=match.id,
                        user_id=player.id,
                        team=team_name,
                        is_winner=is_winner,
                        mmr_delta=actual_delta,
                    )
                    session.add(participation)

                match_count += 1
                if match_type == "singles":
                    singles_count += 1
                else:
                    doubles_count += 1

            # 跳到下一天
            current_time += timedelta(days=1)

        # ==========================================
        # 5. 更新 previous_rank (模擬「上期排名」)
        # ==========================================
        # 用賽季中期的排名作為 previous_rank
        all_records = sorted(season_records.values(), key=lambda r: next(u for u in users if u.id == r.user_id).global_mmr, reverse=True)
        for i, sr in enumerate(all_records):
            # 稍微偏移以產生有趣的趨勢箭頭
            offsets = [0, 1, -1, 0, 2, -1, 0, 1]
            sr.previous_rank = max(1, (i + 1) + offsets[i % len(offsets)])
            session.add(sr)

        # ==========================================
        # 6. 建立幾筆 pending 比賽 (模擬待確認狀態)
        # ==========================================
        now = datetime(2026, 4, 3, 16, 30, 0)

        # Pending 1: 陳大文 vs 林怡君 (等待對手確認)
        pending1 = Match(
            match_type="singles", format="BO3",
            team_a_p1_id=users[0].id, team_b_p1_id=users[1].id,
            score_a=2, score_b=1,
            status="pending", reported_by=users[0].id,
            season_id=season.id, created_at=now - timedelta(hours=2),
        )
        session.add(pending1)
        session.flush()

        # 通知林怡君
        session.add(Notification(
            user_id=users[1].id, match_id=pending1.id,
            type="pending_confirm",
            content=f"{users[0].name} 剛剛送出了一筆 2:1 的比分，請您確認。",
            is_read=False, created_at=now - timedelta(hours=2),
        ))

        # Pending 2: 黃柏翰 vs 陳大文 (等我去確認)
        pending2 = Match(
            match_type="singles", format="BO3",
            team_a_p1_id=users[3].id, team_b_p1_id=users[0].id,
            score_a=2, score_b=0,
            status="pending", reported_by=users[3].id,
            season_id=season.id, created_at=now - timedelta(hours=5),
        )
        session.add(pending2)
        session.flush()

        session.add(Notification(
            user_id=users[0].id, match_id=pending2.id,
            type="pending_confirm",
            content=f"{users[3].name} 剛剛送出了一筆 2:0 的比分，請您確認。",
            is_read=False, created_at=now - timedelta(hours=5),
        ))

        # Pending 3: 雙打 - 陳大文+林怡君 vs 陳偉安+張雅婷
        pending3 = Match(
            match_type="doubles", format="BO3",
            team_a_p1_id=users[0].id, team_a_p2_id=users[1].id,
            team_b_p1_id=users[2].id, team_b_p2_id=users[6].id,
            score_a=2, score_b=0,
            status="pending", reported_by=users[0].id,
            season_id=season.id, created_at=now - timedelta(hours=1),
        )
        session.add(pending3)
        session.flush()

        session.add(Notification(
            user_id=users[2].id, match_id=pending3.id,
            type="pending_confirm",
            content=f"{users[0].name} 剛剛送出了一筆雙打 2:0 的比分，請您確認。",
            is_read=False, created_at=now - timedelta(hours=1),
        ))
        session.add(Notification(
            user_id=users[6].id, match_id=pending3.id,
            type="pending_confirm",
            content=f"{users[0].name} 剛剛送出了一筆雙打 2:0 的比分，請您確認。",
            is_read=False, created_at=now - timedelta(hours=1),
        ))

        # 最終提交所有資料
        session.commit()

        # ==========================================
        # 統計報告
        # ==========================================
        print(f"\n{'='*50}")
        print(f"假資料建立成功！")
        print(f"{'='*50}")
        print(f"比賽統計：")
        print(f"   總比賽數　: {match_count} 場 (已確認)")
        print(f"   單打比賽　: {singles_count} 場")
        print(f"   雙打比賽　: {doubles_count} 場")
        print(f"   待確認比賽: 3 場 (含通知)")
        print(f"\n🏆 最終排行榜 (依賽季積分)：")
        print(f"{'─'*50}")

        # 刷新所有資料
        for u in users:
            session.refresh(u)
        for sr in season_records.values():
            session.refresh(sr)

        sorted_records = sorted(season_records.values(), key=lambda r: next(u for u in users if u.id == r.user_id).global_mmr, reverse=True)
        for rank, sr in enumerate(sorted_records, 1):
            user = next(u for u in users if u.id == sr.user_id)
            total = sr.matches_played
            wr = f"{(sr.wins / total * 100):.1f}%" if total > 0 else "0%"
            print(f"   #{rank}  {user.name:<6}  MMR: {user.global_mmr:>7.1f}  W/L: {sr.wins}/{total - sr.wins}  WR: {wr}")

        print(f"\n🔐 玩家 ID 一覽：")
        print(f"{'─'*50}")
        for u in users:
            print(f"   {u.name:<6} ID: {u.id}")
        print(f"{'─'*50}")


if __name__ == "__main__":
    seed_data()