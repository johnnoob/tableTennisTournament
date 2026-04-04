import os
from dotenv import load_dotenv
from fastapi import FastAPI

# 載入環境變數
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
from routers.matches import router as matches_router
from routers.users import router as users_router
from routers.leaderboard import router as leaderboard_router
from routers.auth import router as auth_router
from routers.seasons import router as seasons_router
from routers.admin import router as admin_router

from starlette.middleware.sessions import SessionMiddleware

from contextlib import asynccontextmanager
from database import create_db_and_tables, get_session
from services.scheduler import scheduler, setup_scheduler
from services.season_service import ensure_current_quarter_season
import logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時執行：建立資料庫與資料表
    create_db_and_tables()
    
    # 啟動排程器
    setup_scheduler()
    scheduler.start()
    
    # 開機預檢：確保現在的季度有賽季可打
    generator = get_session()
    session = next(generator)
    try:
        logging.info("伺服器重啟預檢：檢查當前賽季是否建立...")
        ensure_current_quarter_season(session)
    finally:
        session.close()

    yield
    # 關閉時執行
    scheduler.shutdown()
    # 關閉時執行 (如有需要)

# 1. 建立 FastAPI 應用程式實例，並加上晨星奧運風的專屬標題
app = FastAPI(
    title="Precision Arena API",
    description="機關專屬桌球戰情室系統核心伺服器",
    version="1.0.0",
    lifespan=lifespan
)

# 🌟 新增 Session 中介軟體 (secret_key 從環境變數讀取)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback-secret-string"))

# 2. 設定 CORS (跨來源資源共用)
# 允許來自 Vite 本地開發環境的請求
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # 允許所有 HTTP 請求方法 (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # 允許所有 Header 傳遞
)
# 將 router 掛載到 app 上
app.include_router(matches_router)
app.include_router(users_router)
app.include_router(leaderboard_router)
app.include_router(auth_router)
app.include_router(seasons_router)
app.include_router(admin_router)

# 3. 定義測試用的起手式 Endpoints (路由)

@app.get("/")
def read_root():
    """根目錄測試路由"""
    return {
        "message": "Welcome to Precision Arena API! 🏆",
        "status": "Server is up and running smoothly."
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
        "version": "1.0.0"
    }