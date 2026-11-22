import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from config import settings
from database import get_session
from routers.matches import router as matches_router
from routers.users import router as users_router
from routers.leaderboard import router as leaderboard_router
from routers.auth import router as auth_router
from routers.seasons import router as seasons_router
from routers.admin import router as admin_router
from routers.content import router as content_router
from routers.cron import router as cron_router
from routers.challenges import router as challenges_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動排程器 (僅限非正式環境且明確開啟設定時)
    scheduler = None
    if settings.enable_local_scheduler and not settings.is_production:
        from services.scheduler import setup_scheduler
        scheduler = setup_scheduler()
        scheduler.start()
        logging.info("[Main] Local APScheduler started.")

    # 開機預檢：僅在非正式環境執行，避免 Serverless 冷啟動重複查 DB
    if not settings.is_production:
        from services.season_service import ensure_current_quarter_season

        generator = get_session()
        session = next(generator)
        try:
            logging.info("伺服器重啟預檢：檢查當前賽季是否建立...")
            ensure_current_quarter_season(session)
        finally:
            session.close()

    yield
    # 關閉時執行
    if scheduler is not None:
        from services.scheduler import shutdown_scheduler
        shutdown_scheduler()
        logging.info("[Main] Local APScheduler shut down.")


# 1. 建立 FastAPI 應用程式實例
app = FastAPI(
    title="Precision Arena API",
    description="機關專屬桌球戰情室系統核心伺服器",
    version="1.0.0",
    lifespan=lifespan,
    # 正式環境關閉 Swagger UI 避免暴露 API 文件
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

# 2. Session 中介軟體（讀取 secret_key from settings）
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    https_only=settings.is_production,
)

# 3. CORS 設定（讀取 allowed_origins from settings）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. 掛載所有 routers
app.include_router(matches_router)
app.include_router(users_router)
app.include_router(leaderboard_router)
app.include_router(auth_router)
app.include_router(seasons_router)
app.include_router(admin_router)
app.include_router(content_router)
app.include_router(cron_router)
app.include_router(challenges_router)


@app.get("/")
def read_root():
    """根目錄測試路由"""
    return {
        "message": "Welcome to Precision Arena API! 🏆",
        "status": "Server is up and running smoothly.",
        "environment": settings.app_env,
    }


@app.get("/api/health")
def health_check():
    """
    系統健康檢查節點。
    未來前端的佈告欄可以呼叫這支 API，確認後端伺服器是否存活。
    """
    return {
        "status": "ok",
        "system": "Table Tennis Tournament Engine",
        "version": "1.0.0",
        "environment": settings.app_env,
    }