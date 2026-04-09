# backend/database.py
from sqlmodel import create_engine, Session

# 指定 SQLite 資料庫檔案名稱，它會自動生成在 backend 資料夾下
sqlite_file_name = "arena.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# check_same_thread=False 是 SQLite 在 FastAPI 中非同步環境下的必要設定
connect_args = {"check_same_thread": False}

# 建立資料庫引擎 (echo=True 會在終端機印出底層執行的 SQL 語法，方便開發除錯)
# Schema 管理已交由 Alembic 負責，此處不再呼叫 create_all
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def get_session():
    """依賴注入 (Dependency Injection) 用，負責提供資料庫 Session 給每個 API"""
    with Session(engine) as session:
        yield session