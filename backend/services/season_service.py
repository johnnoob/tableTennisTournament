from sqlmodel import Session, select
from datetime import datetime, timedelta
from models import Season

def get_or_create_current_season(session: Session) -> Season:
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
    active_season = session.exec(
        select(Season).where(Season.status == "active", Season.start_date <= now, Season.end_date > now)
    ).first()
    
    if active_season:
        return active_season
        
    # 3. 建立新的 10 分鐘測試賽季
    minute_block = now.minute // 10
    start_minute = minute_block * 10
    
    start_date = now.replace(minute=start_minute, second=0, microsecond=0)
    end_date = start_date + timedelta(minutes=10)
    
    season_id = f"Test-{start_date.strftime('%Y%m%d-%H%M')}"
    
    new_season = Season(
        id=season_id,
        name=f"極速測試賽季 ({start_date.strftime('%H:%M')})",
        status="active",
        start_date=start_date,
        end_date=end_date
    )
    session.add(new_season)
    session.commit()
    
    return new_season