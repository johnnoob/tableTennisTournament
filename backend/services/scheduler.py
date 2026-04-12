import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import get_session
from config import settings
from services.season_service import auto_generate_quarterly_season

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def _apply_decay(session_factory):
    """
    實施「惰性衰退」扣分邏輯。
    
    規則：
    1. 若 CRON_TEST_MODE = true：強制使用環境變數，單位為「分鐘」。
    2. 若 CRON_TEST_MODE = false：優先使用資料庫 SystemConfig，單位為「天」。
    """
    from sqlmodel import select
    from models import User, MatchParticipation, PlayerStatHistory, Notification, SystemConfig, Match
    from services.elo_engine import ELO_CONFIG

    generator = session_factory()
    session = next(generator)
    try:
        now = datetime.now(timezone.utc)
        
        # 🟢 1. 參數解析邏輯 (依據環境模式切換)
        if settings.cron_test_mode:
            # 測試模式：強制讀取環境變數，單位 [分鐘]
            threshold_val = settings.decay_threshold_value
            cycle_val = settings.decay_cycle_value
            decay_amount = settings.decay_amount
            time_unit = "minutes"
            logger.info(f"[Decay] Running in TEST MODE (Unit: {time_unit})")
        else:
            # 生產模式：優先讀取資料庫，若無則按環境變數預設值，單位 [天]
            def get_cfg(key, default):
                cfg = session.get(SystemConfig, key)
                return cfg.value if cfg else str(default)

            threshold_val = int(get_cfg("decay_days_threshold", settings.decay_threshold_value))
            cycle_val = int(get_cfg("decay_cycle_days", settings.decay_cycle_value))
            decay_amount = float(get_cfg("decay_amount", settings.decay_amount))
            time_unit = "days"
        
        mmr_floor = ELO_CONFIG.get("MIN_MMR_FLOOR", 600.0)
        active_users = session.exec(select(User).where(User.is_active == True)).all()

        decayed_count = 0
        for user in active_users:
            # A. 取得該玩家最近一次出賽時間
            last_match_id = session.exec(
                select(MatchParticipation.match_id)
                .where(MatchParticipation.user_id == user.id)
                .order_by(MatchParticipation.id.desc())
                .limit(1)
            ).first()

            if last_match_id is None:
                continue

            last_match_record = session.get(Match, last_match_id)
            if not last_match_record:
                continue

            last_played = last_match_record.created_at
            if last_played.tzinfo is None:
                last_played = last_played.replace(tzinfo=timezone.utc)

            # B. 計算閒置時間
            time_diff = now - last_played
            if time_unit == "minutes":
                current_inactive = time_diff.total_seconds() / 60
            else:
                current_inactive = time_diff.total_seconds() / 86400  # 使用秒數轉天數更精準

            # C. 檢查是否符合衰退條件
            if current_inactive >= threshold_val:
                should_decay = False
                if user.last_decay_date is None:
                    should_decay = True
                else:
                    last_decay = user.last_decay_date
                    if last_decay.tzinfo is None:
                        last_decay = last_decay.replace(tzinfo=timezone.utc)
                    
                    # 檢查週期
                    decay_diff = now - last_decay
                    if time_unit == "minutes":
                        if decay_diff.total_seconds() / 60 >= cycle_val:
                            should_decay = True
                    else:
                        if decay_diff.total_seconds() / 86400 >= cycle_val:
                            should_decay = True

                if should_decay:
                    old_mmr = user.global_mmr
                    new_mmr = max(old_mmr - decay_amount, mmr_floor)
                    actual_diff = new_mmr - old_mmr
                    
                    if actual_diff < 0:
                        user.global_mmr = new_mmr
                        user.last_decay_date = now
                        session.add(user)

                        session.add(PlayerStatHistory(
                            user_id=user.id,
                            mmr=new_mmr,
                            recorded_at=now,
                            event_type="decay" # 加上事件類型
                        ))

                        session.add(Notification(
                            user_id=user.id,
                            type="match_rejected",
                            content=f"由於您已連續 {int(current_inactive)} {time_unit} 未出賽，系統已自動扣除 {abs(actual_diff):.1f} MMR。",
                            created_at=now
                        ))

                        decayed_count += 1
                        logger.info(f"[Decay] {user.name}: {old_mmr:.1f} -> {new_mmr:.1f} (inactive: {current_inactive:.1f} {time_unit})")

        session.commit()
        if decayed_count:
            logger.info(f"[Decay] Success: Applied decay to {decayed_count} user(s).")
    except Exception as e:
        session.rollback()
        logger.error(f"[Decay] CRITICAL ERROR: {str(e)}")
    finally:
        session.close()

def setup_scheduler():
    """
    設定排程器任務。
    本地開發模式下，只有 settings.enable_local_scheduler = True 才會被啟動。
    """
    # 賽季自動生成 (維持每分鐘掃描一次，確保精準)
    scheduler.add_job(
        auto_generate_quarterly_season,
        trigger=IntervalTrigger(minutes=1),
        args=[get_session],
        id="granular_season_job",
        replace_existing=True
    )

    # 積分衰退檢查
    # 在生產環境通常透過 cron.py Webhook 觸發，故這裡預設頻率較低，僅作為本地開發的後備。
    decay_trigger = IntervalTrigger(minutes=5) if settings.cron_test_mode else IntervalTrigger(hours=12)
    
    scheduler.add_job(
        _apply_decay,
        trigger=decay_trigger,
        args=[get_session],
        id="auto_decay_job",
        replace_existing=True
    )
    
    logger.info(f"[APScheduler] Initialization complete. Local Scheduler: {settings.enable_local_scheduler}")
