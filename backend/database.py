# backend/database.py
import os
from sqlmodel import create_engine, Session
from dotenv import load_dotenv

load_dotenv()

# 從環境變數讀取 DATABASE_URL，沒設定則 fallback 至 SQLite (僅供本地開發緊急備用)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///arena.db")

# PostgreSQL 不需要 check_same_thread，連線池由 SQLAlchemy 管理
# pool_pre_ping=True：每次借出連線前先 ping，避免 stale connection 問題
# pool_size / max_overflow 可依部署規模調整
engine = create_engine(
    DATABASE_URL,
    echo=False,           # 正式環境建議改 False，開發除錯可設 True
    pool_pre_ping=True,   # 防止斷線後的殭屍連線
)

def get_session():
    """依賴注入 (Dependency Injection) 用，負責提供資料庫 Session 給每個 API"""
    with Session(engine) as session:
        yield session