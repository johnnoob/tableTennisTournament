import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── 讓 Python 找得到 backend/ 下的模組 ──────────────────────────────────────
# env.py 在 backend/alembic/env.py，所以 backend/ = 上一層
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── 引入 SQLModel metadata ───────────────────────────────────────────────────
from sqlmodel import SQLModel

# ⚠️ 一定要 import models，否則 SQLModel.metadata 裡面沒有任何 Table 定義
import models  # noqa: F401

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── 指定 metadata，讓 Alembic 做 autogenerate ────────────────────────────────
target_metadata = SQLModel.metadata

# ── 動態設定 DB URL（覆蓋 alembic.ini 的值）────────────────────────────────
# arena.db 就放在 backend/ 底下，env.py 往上一層即可找到
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "arena.db")
config.set_main_option("sqlalchemy.url", f"sqlite:///{DB_PATH}")


def run_migrations_offline() -> None:
    """跑 migration 但不實際連線（輸出 SQL 到 stdout）"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # ← SQLite ALTER TABLE 必要
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """跑 migration 並實際連線資料庫"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # ← SQLite ALTER TABLE 必要
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
