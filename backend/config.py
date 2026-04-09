"""
backend/config.py — 多環境設定中心

載入邏輯：
- 若系統變數 APP_ENV=development (或未設定)：從 backend/.env 載入（本地開發）
- 若 APP_ENV=production：不載入 .env 檔，直接使用平台（Render/Railway）注入的系統環境變數

使用方式：在任何需要設定的模組中 `from config import settings`
"""
import os
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# ── 決定要不要載入 .env 檔 ─────────────────────────────────────────────────
APP_ENV = os.getenv("APP_ENV", "development")

if APP_ENV != "production":
    # 本地開發：載入 backend/.env
    env_file_path = Path(__file__).parent / ".env"
    load_dotenv(env_file_path, override=True)


class Settings(BaseSettings):
    """
    所有設定欄位都對應到環境變數名稱（大小寫不敏感）。
    若環境變數不存在，則使用 default 值（僅限本地開發安全預設，正式環境務必注入真實值）。
    """

    # ── 應用程式環境 ──────────────────────────────────────────────
    app_env: str = "development"

    # ── 資料庫 ────────────────────────────────────────────────────
    database_url: str = "sqlite:///arena.db"  # 緊急 fallback，正式環境必須覆蓋

    # ── JWT 身份驗證 ──────────────────────────────────────────────
    secret_key: str = "fallback-secret-for-dev-only-change-in-prod"
    jwt_secret_key: str = "fallback-jwt-secret-for-dev-only"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── CORS ──────────────────────────────────────────────────────
    allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )

    # ── Google OAuth ──────────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""

    # ── 前端 Base URL（用於 OAuth callback 後的轉跳）────────────────
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # ── Cloudinary ────────────────────────────────────────────────
    cloudinary_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # ── 其他 ──────────────────────────────────────────────────────
    test_mode_scheduler: bool = False

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def allowed_origins_list(self) -> list[str]:
        """將逗號分隔的字串轉為 list，供 CORSMiddleware 使用"""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    class Config:
        # 允許額外欄位（忽略未定義的環境變數）
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """
    使用 lru_cache 確保 Settings 只實例化一次（Singleton 模式）。
    整個應用程式共用同一份 settings 物件。
    """
    return Settings()


# 匯出單例，方便直接 import 使用
settings = get_settings()
