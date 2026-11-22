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
APP_ENV = os.getenv("APP_ENV") or ("production" if os.getenv("VERCEL") else "development")

if APP_ENV != "production" and not os.getenv("VERCEL"):
    # 本地開發：載入 backend/.env
    env_file_path = Path(__file__).parent / ".env"
    load_dotenv(env_file_path, override=True)

DEFAULT_FRONTEND_URL = "http://localhost:5173"
DEFAULT_BACKEND_URL = "http://localhost:8000"
DEFAULT_CRON_SECRET_KEY = "precision-arena-cron-secret-2026"


class Settings(BaseSettings):
    """
    所有設定欄位都對應到環境變數名稱（大小寫不敏感）。
    若環境變數不存在，則使用 default 值（僅限本地開發安全預設，正式環境務必注入真實值）。
    """

    # ── 應用程式環境 ──────────────────────────────────────────────
    app_env: str = APP_ENV

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

    # ── LINE Login OAuth ──────────────────────────────────────────
    line_channel_id: str = ""
    line_channel_secret: str = ""

    # ── 前端 Base URL（用於 OAuth callback 後的轉跳）────────────────
    frontend_url: str = DEFAULT_FRONTEND_URL
    backend_url: str = DEFAULT_BACKEND_URL
    vercel_project_production_url: str = ""
    vercel_url: str = ""

    # ── Cloudinary ────────────────────────────────────────────────
    cloudinary_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # ── 其他 ──────────────────────────────────────────────────────
    admin_emails: str = ""               # 逗號分隔的管理員 Google 信箱清單 (ADMIN_EMAILS)
    enable_test_impersonation: bool = True  # 是否開放管理員建立測試帳號與切換身分模擬測試

    # ── 背景任務 (Cron / Scheduler) ─────────────────────────────────
    enable_local_scheduler: bool = False  # 是否在本地啟動 APScheduler
    cron_test_mode: bool = False         # 測試模式：時間單位會從 Days/Hours 變更為 Minutes
    cron_secret: str = ""                # Vercel Cron 原生環境變數 CRON_SECRET
    cron_secret_key: str = DEFAULT_CRON_SECRET_KEY
    
    # 扣分 (Decay) 參數
    decay_threshold_value: int = 21      # 閒置多少單位開始扣分
    decay_cycle_value: int = 7           # 每次扣分間隔單位
    decay_amount: float = 5.0            # 每次扣分量
    
    # 自動確認 (Auto-confirm) 參數
    match_auto_confirm_duration: int = 48 # 超過多少單位自動確認比賽

    @property
    def admin_emails_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def google_login_enabled(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    @property
    def line_login_enabled(self) -> bool:
        return bool(self.line_channel_id.strip() and self.line_channel_secret.strip())

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def _vercel_origin(self) -> str:
        host = (self.vercel_project_production_url or self.vercel_url).strip()
        if not host:
            return ""
        if host.startswith("http://") or host.startswith("https://"):
            return host.rstrip("/")
        return f"https://{host}".rstrip("/")

    @property
    def effective_frontend_url(self) -> str:
        if self.frontend_url != DEFAULT_FRONTEND_URL or not os.getenv("VERCEL"):
            return self.frontend_url.rstrip("/")
        return self._vercel_origin or self.frontend_url.rstrip("/")

    @property
    def effective_backend_url(self) -> str:
        if self.backend_url != DEFAULT_BACKEND_URL or not os.getenv("VERCEL"):
            return self.backend_url.rstrip("/")
        return self._vercel_origin or self.backend_url.rstrip("/")

    @property
    def effective_cron_secrets(self) -> set[str]:
        if self.cron_secret:
            secrets = {self.cron_secret}
            if self.cron_secret_key and self.cron_secret_key != DEFAULT_CRON_SECRET_KEY:
                secrets.add(self.cron_secret_key)
            return secrets
        return {self.cron_secret_key} if self.cron_secret_key else set()

    @property
    def allowed_origins_list(self) -> list[str]:
        """將逗號分隔的字串轉為 list，供 CORSMiddleware 使用"""
        origins = [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]
        frontend_origin = self.effective_frontend_url
        if frontend_origin and frontend_origin not in origins:
            origins.append(frontend_origin)
        return origins

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
