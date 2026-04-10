from sqlmodel import Session, select
from sqlalchemy import update
from datetime import datetime, timedelta, timezone
from models import Season, SeasonRecord, SystemConfig, User, utc_now
from services.elo_engine import ELO_CONFIG
import logging
import os

logger = logging.getLogger(__name__)

def ensure_utc(dt: datetime | None) -> datetime | None:
    """確保 datetime 對象帶有 UTC 時區資訊，若為 naive 則補上 UTC"""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def get_config_value(session: Session, key: str, default: str) -> str:
    config = session.get(SystemConfig, key)
    return config.value if config else default

def is_season_paused(session: Session) -> bool:
    val = get_config_value(session, "season_paused", "false")
    return val.lower() == "true"

def get_current_season(session: Session) -> Season | None:
    """
    取得目前的正式賽季。如果系統設定為暫停，則不回傳任何賽季(阻斷報分)。
    """
    if is_season_paused(session):
        return None

    now = utc_now()
    
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
        if s.end_date is None or ensure_utc(s.end_date) > now:
            valid_season = s
            break
            
    if valid_season:
        return valid_season
        
    return None


def get_dynamic_season_meta(session: Session, now: datetime):
    """
    依據 SystemConfig 計算目前的賽季 ID 與時間區間。
    支持 天(days), 時(hours), 分(minutes) 的組合間隔。
    """
    # 1. 讀取基準點與間隔
    start_date_str = get_config_value(session, "season_start_date", "2026-01-01T00:00:00")
    base_start = datetime.fromisoformat(start_date_str).replace(tzinfo=timezone.utc)

    # 2. 讀取顆粒度更高的間隔設定
    i_days = int(get_config_value(session, "season_interval_days", "90"))
    i_hours = int(get_config_value(session, "season_interval_hours", "0"))
    i_mins = int(get_config_value(session, "season_interval_minutes", "0"))
    
    # 總秒數作為計算基準
    interval_seconds = (i_days * 86400) + (i_hours * 3600) + (i_mins * 60)

    if interval_seconds <= 0:
        interval_seconds = 3600 * 24 * 90 # 預案：防止除以 0，預設 90 天
        
    # 3. 計算目前的「桶 (Bucket)」索引
    total_elapsed_seconds = (now - base_start).total_seconds()
    
    if total_elapsed_seconds < 0:
        # 如果現在時間早於起始基準，則使用基準點作為第一個桶
        bucket_index = 0
    else:
        bucket_index = int(total_elapsed_seconds // interval_seconds)
    
    # 4. 生成賽季元數據
    # 使用 S{index} 作為 ID 避免時間格式的侷限
    current_id = f"S{bucket_index}"
    name = f"正式賽季 #{bucket_index + 1}"
    
    calc_start_date = base_start + timedelta(seconds=bucket_index * interval_seconds)
    calc_end_date = calc_start_date + timedelta(seconds=interval_seconds)
    
    return current_id, name, calc_start_date, calc_end_date

def ensure_current_quarter_season(session: Session) -> Season:
    """
    確保目前的賽季存在。
    """
    now = utc_now()
    current_id, name, start_date, end_date = get_dynamic_season_meta(session, now)
    
    existing_season = session.get(Season, current_id)
    
    if existing_season:
        needs_update = False
        # 檢查並同步狀態、名稱、開始與結束時間
        if existing_season.status != "active":
            existing_season.status = "active"
            needs_update = True
        
        # 如果系統設定 (interval) 改變了，同步更新現有的 S 桶時間
        if existing_season.name != name:
            existing_season.name = name
            needs_update = True
        if ensure_utc(existing_season.start_date) != start_date:
            existing_season.start_date = start_date
            needs_update = True
        if ensure_utc(existing_season.end_date) != end_date:
            existing_season.end_date = end_date
            needs_update = True
            
        if needs_update:
            session.add(existing_season)
            session.commit()
            session.refresh(existing_season)
        return existing_season
        
    # 關閉所有現存的活躍賽季
    active_seasons = session.exec(
        select(Season).where(Season.status == "active")
    ).all()
    for old_season in active_seasons:
        old_season.status = "completed"
        # 確保過期賽季有 end_date
        if not old_season.end_date or ensure_utc(old_season.end_date) > now:
             old_season.end_date = now
        session.add(old_season)

    # 📸 季末快照：為每位玩家記錄當前 MMR 至 SeasonRecord.final_mmr
    for old_season in active_seasons:
        season_records = session.exec(
            select(SeasonRecord).where(SeasonRecord.season_id == old_season.id)
        ).all()
        for record in season_records:
            user = session.get(User, record.user_id)
            if user:
                record.final_mmr = user.global_mmr
                session.add(record)
    session.commit()

    # 🔄 執行軟重置，將所有活躍玩家的 MMR 向基準分回歸
    soft_reset_all_users_mmr(session)

    # 產生新賽季
    new_season = Season(
        id=current_id,
        name=name,
        status="active",
        start_date=start_date,
        end_date=end_date
    )
    session.add(new_season)
    session.commit()
    session.refresh(new_season)
    return new_season

def auto_generate_quarterly_season(session_factory):
    """
    排程器呼叫入口，若系統暫停則不動作。
    """
    generator = session_factory()
    session = next(generator)
    try:
        # 如果管理員設定暫停，則不自動產生新賽季
        if is_season_paused(session):
            return
        ensure_current_quarter_season(session)
    finally:
        session.close()


def soft_reset_all_users_mmr(session: Session) -> int:
    """
    賽季結束時執行「軟重置」：將所有活躍玩家的 global_mmr 向基準分 (1000) 回歸。
    公式：new_mmr = (current_mmr + DEFAULT_BASE_MMR) / 2

    這能防止積分長期通脹，同時保留玩家的相對排名優勢。

    Returns:
        更新的玩家人數
    """
    baseline = ELO_CONFIG["DEFAULT_BASE_MMR"]

    result = session.exec(
        update(User)
        .where(User.is_active == True)
        .values(global_mmr=(User.global_mmr + baseline) / 2)
        .execution_options(synchronize_session="fetch")
    )
    session.commit()

    updated_count = result.rowcount if hasattr(result, "rowcount") else -1
    logger.info(
        f"[SoftReset] Regressed all active users' MMR toward {baseline}. "
        f"Rows affected: {updated_count}"
    )
    return updated_count