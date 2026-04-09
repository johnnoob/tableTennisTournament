# backend/database.py
from sqlmodel import create_engine, Session
from config import settings

# 從 settings 讀取資料庫 URL
# 正式環境：由 Render/Neon 等平台注入的 DATABASE_URL 系統環境變數
# 本地開發：從 backend/.env 載入
engine = create_engine(
    settings.database_url,
    echo=not settings.is_production,  # 正式環境關閉 SQL echo 避免洩露資訊
    pool_pre_ping=True,               # 防止 stale connection
)

def get_session():
    """依賴注入 (Dependency Injection) 用，負責提供資料庫 Session 給每個 API"""
    with Session(engine) as session:
        yield session