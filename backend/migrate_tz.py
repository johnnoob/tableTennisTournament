import sqlite3
from datetime import datetime, timedelta

# 資料庫路徑
DB_PATH = "arena.db"

# 定義時間點 (當我們開始從 UTC+8 轉向 UTC 的時間)
# 台灣時間 2026-04-07 13:14:11 之前的高於 08:00 的紀錄
# 或是直接過濾掉已經是 UTC (05:xx, 04:xx) 的紀錄
CUTOFF_TIME_TW = "2026-04-07 13:14:11"

TABLE_COLS = {
    "match": "created_at",
    "notification": "created_at",
    "playerstathistory": "recorded_at",
    "announcement": "created_at",
    "season": "start_date" # Season 的 start_date 也需要，否則 get_current_season 可能會掛掉
}

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print(f"🚀 開始時區校準 (UTC+8 -> UTC)...")
    
    total_updated = 0
    
    for table, col in TABLE_COLS.items():
        # 1. 找出所有在今天，且時間顯示為「下午」(12, 13) 或大於 8 點的 naive 紀錄
        # 這裡我們使用比較保險的方法：
        # 如果時間字串裡面沒有 +00:00 且大於 '2026-01-01 08:00:00'，我們就統一減 8
        # (因為這是一個新專案，2026 以前沒資料)
        
        # 查詢
        cursor.execute(f"SELECT id, {col} FROM {table}")
        rows = cursor.fetchall()
        
        updates = []
        for row_id, date_str in rows:
            if not date_str: continue
            
            # 如果已經有時區標記，或者是 00:00 (S1 這種)，我們略過
            if "+00:00" in date_str or "Z" in date_str:
                continue
            
            # 解析
            try:
                # 處理帶有微秒或沒帶的情況
                if "." in date_str:
                    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S.%f")
                else:
                    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                
                # 精確判斷：
                # 今天的資料：如果小時 >= 7 (台灣 07:00~13:30)，則是本地時間，需減 8。
                # 之前的資料：全都是本地時間，全部減 8。
                today = datetime.now().date()
                if dt.date() < today or (dt.date() == today and dt.hour >= 7):
                    new_dt = dt - timedelta(hours=8)
                    new_dt_str = new_dt.strftime("%Y-%m-%d %H:%M:%S.%f")
                    updates.append((new_dt_str, row_id))
            except Exception as e:
                print(f"⚠️ 解析 {table}.{col} 失敗: {date_str} - {str(e)}")
                continue
        
        # 批次更新
        if updates:
            print(f"📦 正在更新 {table} 表，共 {len(updates)} 筆紀錄...")
            cursor.executemany(f"UPDATE {table} SET {col} = ? WHERE id = ?", updates)
            total_updated += len(updates)

    # 處理 Season 的 end_date (它是 Optional)
    cursor.execute("SELECT id, end_date FROM season WHERE end_date IS NOT NULL")
    rows = cursor.fetchall()
    season_updates = []
    for row_id, date_str in rows:
        if date_str and "+00:00" not in date_str:
             dt = datetime.fromisoformat(date_str)
             if dt > datetime(2026, 1, 1, 7, 0, 0):
                 new_dt = dt - timedelta(hours=8)
                 season_updates.append((new_dt.strftime("%Y-%m-%d %H:%M:%S.%f"), row_id))
    if season_updates:
        cursor.executemany("UPDATE season SET end_date = ? WHERE id = ?", season_updates)
        total_updated += len(season_updates)

    conn.commit()
    conn.close()
    
    print(f"✅ 校準完成！共修復 {total_updated} 筆時間戳記紀錄。")

if __name__ == "__main__":
    migrate()
