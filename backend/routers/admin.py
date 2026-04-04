from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from database import get_session
from models import User, Season
from schemas import SeasonCreate
from services.auth_jwt import get_current_admin_user
from datetime import datetime
import re

# 宣告這是一個獨立的 Router，並全面套用管理員驗證
router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Control Center"],
    dependencies=[Depends(get_current_admin_user)]
)

@router.get("/status")
def check_admin_access(current_admin: User = Depends(get_current_admin_user)):
    """
    測試用 API：確認管理員身分驗證是否成功。
    """
    return {
        "status": "success",
        "message": f"歡迎進入控制中心，管理員 {current_admin.name}！"
    }

# ==========================================
# 🌟 開啟新賽季的 API
# ==========================================
@router.post("/seasons")
def create_new_season(
    season_in: SeasonCreate,
    session: Session = Depends(get_session),
    # 這裡雖然有 dependencies 幫忙擋，但我們還是可以把 admin 拿進來做紀錄(若未來有需要)
    current_admin: User = Depends(get_current_admin_user) 
):
    """
    管理員專屬：手動開啟全新賽季。
    強制命名格式為 YYYY-QX，例如 2026-Q2。
    """
    # 1. 檢核賽季命名格式
    if not re.match(r"^\d{4}-Q[1-4]$", season_in.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="賽季 ID 必須符合 YYYY-QX 格式，例如：2026-Q1"
        )
        
    # 2. 檢查這個賽季代號是否已經被用過了
    existing_season = session.get(Season, season_in.id)
    if existing_season:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="這個賽季代號已經存在了，請換一個！"
        )

    now = datetime.utcnow()
    # 3. 把舊的賽季關閉 (跟排程器邏輯一致)
    expired_seasons = session.exec(
        select(Season).where(Season.status == "active")
    ).all()
    for old_season in expired_seasons:
        old_season.status = "completed"
        if not old_season.end_date:
            old_season.end_date = now
        session.add(old_season)

    # 4. 建立新的賽季物件 (如果前端沒傳開始時間，預設為現在)
    new_season = Season(
        id=season_in.id,
        name=season_in.name,
        start_date=season_in.start_date or now,
        end_date=season_in.end_date,
        status="active"
    )
    
    # 5. 寫入資料庫
    session.add(new_season)
    session.commit()
    session.refresh(new_season)
    
    return {
        "message": f"成功結算舊賽季並開啟新賽季：{new_season.name}！",
        "season": new_season
    }