import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
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
    """
    # 判斷是否為測試模式：如果在環境變數中設定了 TEST_MODE_SCHEDULER=true，則改為每10分鐘觸發一次
    test_mode = os.getenv("TEST_MODE_SCHEDULER", "false").lower() == "true"
    
    if test_mode:
        logger.info("🔧 [APScheduler] 測試模式啟動：每 10 分鐘自動檢測並生成賽季")
        trigger = IntervalTrigger(minutes=1)
    else:
        logger.info("📅 [APScheduler] 正式模式啟動：每年 1, 4, 7, 10 月 1 日凌晨 0 點自動結算與生成新賽季")
        # 每年四個季度的第一天凌晨執行
        trigger = CronTrigger(month='1,4,7,10', day=1, hour=0, minute=0)

    # 加入排程任務
    scheduler.add_job(
        auto_generate_quarterly_season,
        trigger=trigger,
        args=[get_session],
        id="quarterly_season_job",
        replace_existing=True
    )
