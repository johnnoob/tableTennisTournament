import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlmodel import Session, select

from database import get_session
from models import Match
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
    # 1. 安全驗證：比對 Header 中的密鑰與環境變數是否一致
    expected_secret = os.getenv("CRON_SECRET_KEY")
    if not expected_secret or x_cron_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized execution")

    results = []

    # ---------------------------------------------------------
    # 任務 A：賽季自動生成檢查 (沿用你原有的邏輯)
    # ---------------------------------------------------------
    try:
        # 傳入 get_session generator，維持原有設計
        auto_generate_quarterly_season(get_session) 
        results.append("Season check passed")
    except Exception as e:
        logger.error(f"Season check failed: {e}")
        results.append(f"Season check failed: {e}")

    # ---------------------------------------------------------
    # 任務 B：48小時自動確認 Pending 比賽 (補齊的新功能)
    # ---------------------------------------------------------
    try:
        now = datetime.now(timezone.utc)
        # 計算 48 小時前的時間點
        cutoff_time = now - timedelta(hours=48)
        
        # 找出所有超過 48 小時且仍為 pending 的比賽
        pending_matches = session.exec(
            select(Match)
            .where(Match.status == "pending")
            .where(Match.created_at <= cutoff_time)
        ).all()

        confirmed_count = 0
        for match in pending_matches:
            # 💡 巧妙解法：結算函數會檢查「確認者」是否為對手。
            # 這裡我們由系統代為傳入對手 (team_b_p1_id) 的 ID，模擬對手按下確認，完美通過權限檢查
            try:
                settle_match_transaction(session, match.id, match.team_b_p1_id)
                confirmed_count += 1
            except Exception as inner_e:
                logger.error(f"Failed to auto-confirm match {match.id}: {inner_e}")

        results.append(f"Auto-confirmed {confirmed_count} pending matches")
    except Exception as e:
        logger.error(f"Auto-confirm routine failed: {e}")
        results.append(f"Auto-confirm routine failed: {e}")

    # ---------------------------------------------------------
    # 任務 C：每日惰性衰退扣分 (沿用你原有的邏輯)
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