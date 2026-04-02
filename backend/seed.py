# backend/seed.py
from sqlmodel import Session, SQLModel
from database import engine, create_db_and_tables
from models import User, Season, SeasonRecord, PlayerStatHistory
from datetime import datetime
import uuid

def seed_data():
    print("🧹 正在清除舊有資料並重建資料表...")
    # 開發測試用：每次執行都會清空資料庫重來，確保資料乾淨
    SQLModel.metadata.drop_all(engine)
    create_db_and_tables()

    with Session(engine) as session:
        print("🌱 開始種植假資料...")

        # ==========================================
        # 1. 建立當前進行中的賽季
        # ==========================================
        current_season = Season(
            id="2026-S1",
            name="2026 春季例行賽",
            status="active",
            start_date=datetime.utcnow()
        )
        session.add(current_season)
        print("✅ 賽季建立完成: 2026 春季例行賽")

        # ==========================================
        # 2. 建立機關同仁資料 (包含不同實力與裝備)
        # ==========================================
        user_wang = User(
            email="wang@agency.gov.tw",
            name="王科長",
            department="資訊室",
            dominant_hand="右手",
            playstyle="直板快攻",
            rubber_forehand="短顆粒",
            rubber_backhand="防弧膠",
            global_mmr=1600.0,  # 高手
            role="admin"
        )
        
        user_lin = User(
            email="lin@agency.gov.tw",
            name="林專員",
            department="秘書室",
            dominant_hand="左手",
            playstyle="刀板兩面弧圈",
            rubber_forehand="平面-澀性",
            rubber_backhand="平面-澀性",
            global_mmr=1200.0,  # 中階
            role="user"
        )

        user_chen = User(
            email="chen@agency.gov.tw",
            name="陳辦事員",
            department="人事室",
            dominant_hand="右手",
            playstyle="削球防守",
            rubber_forehand="平面-黏性",
            rubber_backhand="長顆粒",
            global_mmr=1000.0,  # 新手
            role="user"
        )

        # 將玩家加入 Session 並 commit 以取得系統生成的 UUID
        session.add_all([user_wang, user_lin, user_chen])
        session.commit()
        
        # 重新整理物件以確保拿到 UUID
        session.refresh(user_wang)
        session.refresh(user_lin)
        session.refresh(user_chen)
        print(f"✅ 玩家建立完成: {user_wang.name}, {user_lin.name}, {user_chen.name}")

        # ==========================================
        # 3. 建立賽季戰績關聯 (SeasonRecord)
        # ==========================================
        records = [
            SeasonRecord(user_id=user_wang.id, season_id=current_season.id, season_lp=50.0, matches_played=10, wins=8, previous_rank=1),
            SeasonRecord(user_id=user_lin.id, season_id=current_season.id, season_lp=20.0, matches_played=8, wins=4, previous_rank=3),
            SeasonRecord(user_id=user_chen.id, season_id=current_season.id, season_lp=0.0, matches_played=2, wins=0, previous_rank=2)
        ]
        session.add_all(records)
        print("✅ 賽季初始戰績建立完成")

        # ==========================================
        # 4. 建立初始歷史快照 (PlayerStatHistory)
        # ==========================================
        # 讓前端的圖表有一開始的起點可以畫
        histories = [
            PlayerStatHistory(user_id=user_wang.id, mmr=1600.0, season_lp=50.0),
            PlayerStatHistory(user_id=user_lin.id, mmr=1200.0, season_lp=20.0),
            PlayerStatHistory(user_id=user_chen.id, mmr=1000.0, season_lp=0.0)
        ]
        session.add_all(histories)
        print("✅ 玩家歷史數據快照建立完成")

        # 最終提交所有變更
        session.commit()
        
        print("\n🎉 假資料建立成功！以下為測試用的 ID 資訊 (報分時會用到)：")
        print("-" * 50)
        print(f"王科長 (報分發起人) ID : {user_wang.id}")
        print(f"林專員 (對手/接收者) ID: {user_lin.id}")
        print(f"陳辦事員            ID: {user_chen.id}")
        print("-" * 50)

if __name__ == "__main__":
    seed_data()