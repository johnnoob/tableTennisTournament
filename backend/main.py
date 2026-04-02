from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 1. 建立 FastAPI 應用程式實例，並加上晨星奧運風的專屬標題
app = FastAPI(
    title="Precision Arena API",
    description="機關專屬桌球戰情室系統核心伺服器",
    version="1.0.0"
)

# 2. 設定 CORS (跨來源資源共用)
# 允許來自 Vite 本地開發環境的請求
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # 允許所有 HTTP 請求方法 (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # 允許所有 Header 傳遞
)

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