import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlmodel import Session, select

from database import get_session
from models import Match, SystemConfig # Added SystemConfig
from config import settings               # Added settings
from services.match_service import settle_match_transaction
from services.scheduler import _apply_decay
from services.season_service import auto_generate_quarterly_season

router = APIRouter(tags=["Internal Cron"])
logger = logging.getLogger(__name__)

@router.post("/api/internal/cron/run-tasks", summary="執行所有背景排程任務 (需攜帶密鑰)")
def run_scheduled_tasks(
    x_cron_secret: str = Header(...), 
    session: Session = Depends(get_session)
):
    # 🟢 1. 安全驗證：比對 Header 中的密鑰與環境變數
    if x_cron_secret != settings.cron_secret_key:
        raise HTTPException(status_code=401, detail="Unauthorized execution: Invalid secret key")

    results = []

    # ---------------------------------------------------------
    # 任務 A：賽季自動生成檢查
    # ---------------------------------------------------------
    try:
        auto_generate_quarterly_season(get_session) 
        results.append("Season check passed")
    except Exception as e:
        logger.error(f"Season check failed: {e}")
        results.append(f"Season check failed: {e}")

    # ---------------------------------------------------------
    # 任務 B：自動確認 Pending 比賽 (具備環境感知)
    # ---------------------------------------------------------
    try:
        now = datetime.now(timezone.utc)
        
        # 🔑 決定判定持續時間與單位
        if settings.cron_test_mode:
            # 測試模式：強制由環境變數決定 [分鐘]
            duration_val = settings.match_auto_confirm_duration
            cutoff_time = now - timedelta(minutes=duration_val)
            unit_label = "minutes"
        else:
            # 生產模式：優先讀取資料庫 SystemConfig [小時]
            def get_cfg(key, default):
                cfg = session.get(SystemConfig, key)
                return cfg.value if cfg else str(default)
            
            duration_val = int(get_cfg("match_auto_confirm_hours", settings.match_auto_confirm_duration))
            cutoff_time = now - timedelta(hours=duration_val)
            unit_label = "hours"

        # 找出所有超時且仍為 pending 的比賽
        pending_matches = session.exec(
            select(Match)
            .where(Match.status == "pending")
            .where(Match.created_at <= cutoff_time)
        ).all()

        confirmed_count = 0
        for match in pending_matches:
            # 由系統模擬對手 (team_b_p1_id) 的確認操作
            try:
                settle_match_transaction(session, match.id, match.team_b_p1_id)
                confirmed_count += 1
            except Exception as inner_e:
                logger.error(f"Failed to auto-confirm match {match.id}: {inner_e}")

        results.append(f"Auto-confirmed {confirmed_count} pending matches (Threshold: {duration_val} {unit_label})")
    except Exception as e:
        logger.error(f"Auto-confirm routine failed: {e}")
        results.append(f"Auto-confirm routine failed: {e}")

    # ---------------------------------------------------------
    # 任務 C：積分衰退檢查
    # ---------------------------------------------------------
    try:
        _apply_decay(get_session)
        results.append("Decay check passed")
    except Exception as e:
        logger.error(f"Decay check failed: {e}")
        results.append(f"Decay check failed: {e}")

    return {
        "status": "success",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tasks_run": results
    }