from sqlmodel import Session, select
from datetime import datetime
from models import Season

def get_current_season(session: Session) -> Season | None:
    """
    取得目前的正式賽季。
    """
    now = datetime.utcnow()
    
    # 1. 巡視並結算過期賽季
    expired_seasons = session.exec(
        select(Season).where(Season.status == "active", Season.end_date <= now)
    ).all()
    for old_season in expired_seasons:
        old_season.status = "completed"
        session.add(old_season)
    if expired_seasons:
        session.commit()

    # 2. 尋找目前涵蓋的活躍賽季
    statement = select(Season).where(
        Season.status == "active",
        Season.start_date <= now
    )
    active_seasons = session.exec(statement).all()
    
    valid_season = None
    for s in active_seasons:
        if s.end_date is None or s.end_date > now:
            valid_season = s
            break
            
    if valid_season:
        return valid_season
        
    return None


def get_quarter_id(date_obj: datetime) -> str:
    """計算給定時間對應的季度 ID，回傳例如: 2026-Q2"""
    year = date_obj.year
    quarter = (date_obj.month - 1) // 3 + 1
    return f"{year}-Q{quarter}"

def get_quarter_start_date(date_obj: datetime) -> datetime:
    """計算給定時間該季度的開始日期"""
    year = date_obj.year
    quarter = (date_obj.month - 1) // 3 + 1
    start_month = 3 * quarter - 2
    return datetime(year, start_month, 1)

import os

def ensure_current_quarter_season(session: Session) -> Season:
    """
    確保目前季度的賽季存在。如果不存在，則建立它並作為目前的賽季。
    無論是重啟自動預檢，還是定期排程，都呼叫這支 API 確保賽季健康。
    """
    now = datetime.utcnow()
    test_mode = os.getenv("TEST_MODE_SCHEDULER", "false").lower() == "true"
    
    if test_mode:
        current_q_id = f"TEST-{now.strftime('%H%M')}"
        name = f"測試賽季 {now.strftime('%H:%M')}"
        start_date = now
    else:
        current_q_id = get_quarter_id(now)
        year = now.year
        quarter = (now.month - 1) // 3 + 1
        name = f"{year} 積分賽 Q{quarter}"
        start_date = get_quarter_start_date(now)
    
    existing_season = session.get(Season, current_q_id)
    if existing_season:
        # 如果對應季度的賽季已經存在但不處於 active，可以視需求把它變回去
        if existing_season.status != "active":
            existing_season.status = "active"
            session.add(existing_season)
            session.commit()
            session.refresh(existing_season)
        return existing_season
        
    # 關閉所有現存的活躍賽季
    expired_seasons = session.exec(
        select(Season).where(Season.status == "active")
    ).all()
    for old_season in expired_seasons:
        old_season.status = "completed"
        if not old_season.end_date:
             old_season.end_date = now
        session.add(old_season)
        
    # 生產這(分/季)的新賽季
    new_season = Season(
        id=current_q_id,
        name=name,
        status="active",
        start_date=start_date
    )
    session.add(new_season)
    session.commit()
    session.refresh(new_season)
    return new_season

def auto_generate_quarterly_season(session_factory):
    """
    由 APScheduler 從背景呼叫的方法，無法直接注入 Depends，因此接受一個 generator。
    """
    # 建立獨立的 Session
    generator = session_factory()
    session = next(generator)
    try:
        ensure_current_quarter_season(session)
    finally:
        session.close()