import os
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import get_session
from services.season_service import auto_generate_quarterly_season
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()




def _apply_decay(session_factory):
    """
    每日惰性衰退：對超過 threshold 天未出賽的玩家扣分。
    採用「時間差錨點」邏輯：
    1. 閒置天數 >= threshold (預設 21 天)
    2. 距離上次扣分 (last_decay_date) 已超過 7 天 (或從未扣過)
    這樣即使伺服器當機，恢復後也會補扣。
    """
    from sqlmodel import Session, select
    from models import User, MatchParticipation, PlayerStatHistory, Notification, SystemConfig, Match
    from services.elo_engine import ELO_CONFIG

    generator = session_factory()
    session = next(generator)
    try:
        now = datetime.now(timezone.utc)
        
        # 1. 讀取配置
        def get_cfg(key, default):
            cfg = session.get(SystemConfig, key)
            return cfg.value if cfg else default

        threshold_days = int(get_cfg("decay_days_threshold", "21"))
        decay_amount = float(get_cfg("decay_amount", "5.0"))
        mmr_floor = ELO_CONFIG.get("MIN_MMR_FLOOR", 600.0)

        active_users = session.exec(select(User).where(User.is_active == True)).all()

        decayed_count = 0
        for user in active_users:
            # 取得該玩家最近一次出賽時間
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

            days_inactive = (now - last_played).days

            # 2. 檢查是否符合衰退條件
            if days_inactive >= threshold_days:
                # 檢查時間差錨點：距離上次衰退是否已滿 7 天
                should_decay = False
                if user.last_decay_date is None:
                    should_decay = True
                else:
                    last_decay = user.last_decay_date
                    if last_decay.tzinfo is None:
                        last_decay = last_decay.replace(tzinfo=timezone.utc)
                    if (now - last_decay).days >= 7:
                        should_decay = True

                if should_decay:
                    old_mmr = user.global_mmr
                    new_mmr = max(old_mmr - decay_amount, mmr_floor)
                    actual_diff = new_mmr - old_mmr
                    
                    if actual_diff < 0:
                        # 執行扣分與更新錨點
                        user.global_mmr = new_mmr
                        user.last_decay_date = now
                        session.add(user)

                        # 紀錄歷史
                        session.add(PlayerStatHistory(
                            user_id=user.id,
                            mmr=new_mmr,
                            recorded_at=now
                        ))

                        # 送出通知
                        session.add(Notification(
                            user_id=user.id,
                            type="match_rejected",  # 借用類別或新增一個，此處暫用 match_rejected 的顏色表現
                            content=f"由於您已連續 {days_inactive} 天未出賽，系統已自動扣除 {abs(actual_diff):.1f} MMR 以維持積分公平性。",
                            created_at=now
                        ))

                        decayed_count += 1
                        logger.info(f"[Decay] {user.name}: {old_mmr:.1f} -> {new_mmr:.1f} (last match {days_inactive}d ago)")

        session.commit()
        if decayed_count:
            logger.info(f"[Decay] Applied decay to {decayed_count} user(s).")
    except Exception as e:
        session.rollback()
        logger.error(f"[Decay] Error during decay process: {str(e)}")
    finally:
        session.close()


def setup_scheduler():
    """
    設定並準備啟動 APScheduler。
    全面採用每 1 分鐘一次的高頻動態檢查，確保與管理員設定同步。
    """
    test_mode = os.getenv("TEST_MODE_SCHEDULER", "false").lower() == "true"

    # 無論是否測試模式，皆使用 1 分鐘間隔檢查，以支持分進秒出的動態更新
    logger.info("[APScheduler] Scheduling season auto-generation (1-min interval) and daily decay check.")
    trigger = IntervalTrigger(minutes=1)

    # 加入排程任務 — 賽季自動生成
    scheduler.add_job(
        auto_generate_quarterly_season,
        trigger=trigger,
        args=[get_session],
        id="granular_season_job",
        replace_existing=True
    )

    # 加入排程任務 — 每日惰性衰退 (每天執行一次)
    scheduler.add_job(
        _apply_decay,
        trigger=IntervalTrigger(days=1),
        args=[get_session],
        id="daily_decay_job",
        replace_existing=True
    )
