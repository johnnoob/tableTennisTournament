import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import get_session
from services.season_service import auto_generate_quarterly_season
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def setup_scheduler():
    """
    設定並準備啟動 APScheduler。
    全面採用每 1 分鐘一次的高頻動態檢查，確保與管理員設定同步。
    """
    test_mode = os.getenv("TEST_MODE_SCHEDULER", "false").lower() == "true"
    
    # 無論是否測試模式，皆使用 1 分鐘間隔檢查，以支持分進秒出的動態更新
    logger.info("📅 [APScheduler] 啟動每 1 分鐘自動檢測與生成賽季任務")
    trigger = IntervalTrigger(minutes=1)

    # 加入排程任務
    scheduler.add_job(
        auto_generate_quarterly_season,
        trigger=trigger,
        args=[get_session],
        id="granular_season_job",
        replace_existing=True
    )
