# backend/database.py
import threading
from sqlalchemy import inspect, text
from sqlalchemy.pool import NullPool
from sqlmodel import create_engine, Session
from config import settings

# 從 settings 讀取資料庫 URL
# 正式環境：由 Vercel/Neon 等平台注入的 DATABASE_URL 系統環境變數
# 本地開發：從 backend/.env 載入
engine_kwargs = (
    {"poolclass": NullPool}
    if settings.is_production
    else {"pool_pre_ping": True}
)

engine = create_engine(
    settings.database_url,
    echo=not settings.is_production,  # 正式環境關閉 SQL echo 避免洩露資訊
    **engine_kwargs,
)

_user_oauth_columns_ready = False
_user_oauth_lock = threading.Lock()


def ensure_user_oauth_columns(target_engine=None) -> None:
    """確保 User 資料表具備雙帳號綁定所需欄位與索引（支援 SQLite / PostgreSQL）。"""
    global _user_oauth_columns_ready
    if target_engine is None and _user_oauth_columns_ready:
        return

    db_engine = target_engine or engine
    with _user_oauth_lock:
        if target_engine is None and _user_oauth_columns_ready:
            return
        with db_engine.connect() as conn:
            inspector = inspect(conn)
            if not inspector.has_table("user"):
                return
            existing_cols = {col["name"] for col in inspector.get_columns("user")}
            missing_cols = [
                col for col in ("google_id", "line_user_id", "line_display_name")
                if col not in existing_cols
            ]

        if not missing_cols:
            if target_engine is None:
                _user_oauth_columns_ready = True
            return

        with db_engine.begin() as conn:
            is_pg = conn.dialect.name == "postgresql"
            for col in missing_cols:
                if is_pg:
                    conn.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col} VARCHAR'))
                else:
                    conn.execute(text(f'ALTER TABLE "user" ADD COLUMN {col} VARCHAR'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_user_google_id ON "user" (google_id)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_user_line_user_id ON "user" (line_user_id)'))
            conn.execute(
                text(
                    'UPDATE "user" SET google_id = oauth_id '
                    "WHERE auth_provider = 'google' AND oauth_id IS NOT NULL AND google_id IS NULL"
                )
            )
            conn.execute(
                text(
                    'UPDATE "user" SET line_user_id = oauth_id '
                    "WHERE auth_provider = 'line' AND oauth_id IS NOT NULL AND line_user_id IS NULL"
                )
            )
        if target_engine is None:
            _user_oauth_columns_ready = True


def get_session():
    """依賴注入 (Dependency Injection) 用，負責提供資料庫 Session 給每個 API"""
    ensure_user_oauth_columns()
    with Session(engine) as session:
        yield session


def create_db_and_tables():
    """建立所有定義在 models.py 中的資料表"""
    from sqlmodel import SQLModel
    # 導入 models 以確保所有資料表已註冊到 metadata
    import models
    SQLModel.metadata.create_all(engine)
    ensure_user_oauth_columns()