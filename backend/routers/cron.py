from datetime import datetime, timedelta, timezone
import hmac
import json
import logging
import time
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import Match
from services.match_service import settle_match_transaction
from services.scheduler import _apply_decay
from services.season_service import (
    get_config_value,
    get_current_season,
    is_season_expired,
    set_config_value,
)

router = APIRouter(tags=["Internal Cron"])
logger = logging.getLogger(__name__)


def execute_cron_tasks(session: Session, trigger: str = "vercel_cron") -> dict:
    """
    執行精簡化例行排程任務：
    1. 超時待確認比賽自動確認與 ELO 結算
    2. 選配啟用之久未出賽惰性衰退檢查
    3. 賽季到期提醒檢查（唯讀狀態紀錄，不強制擅自換季）
    並將執行紀錄寫入 SystemConfig，供管理後台即時查看健康度。
    """
    start_ts = time.perf_counter()
    now = datetime.now(timezone.utc)
    tasks_run: list[str] = []
    errors: list[str] = []

    auto_confirmed_count = 0
    auto_confirm_val = 0
    auto_confirm_unit = "hours"

    # 任務 A：自動確認超時 Pending 比賽
    try:
        if settings.cron_test_mode:
            auto_confirm_val = settings.match_auto_confirm_duration
            cutoff_time = now - timedelta(minutes=auto_confirm_val)
            auto_confirm_unit = "minutes"
        else:
            auto_confirm_val = int(
                get_config_value(
                    session,
                    "match_auto_confirm_hours",
                    str(settings.match_auto_confirm_duration),
                )
            )
            cutoff_time = now - timedelta(hours=auto_confirm_val)
            auto_confirm_unit = "hours"

        pending_matches = session.exec(
            select(Match)
            .where(Match.status == "pending")
            .where(Match.created_at <= cutoff_time)
        ).all()

        unit_zh = "分鐘" if auto_confirm_unit == "minutes" else "小時"
        threshold_label = f"{auto_confirm_val} {unit_zh}"

        for match in pending_matches:
            try:
                settle_match_transaction(
                    session,
                    match.id,
                    match.team_b_p1_id,
                    auto_confirmed=True,
                    threshold_label=threshold_label,
                )
                auto_confirmed_count += 1
            except Exception as inner_e:
                logger.error(f"Failed to auto-confirm match {match.id}: {inner_e}")
                errors.append(f"Match {match.id}: {inner_e}")

        tasks_run.append(
            f"自動確認 {auto_confirmed_count} 場超時比賽（門檻：{auto_confirm_val} {auto_confirm_unit}）"
        )
    except Exception as e:
        logger.error(f"Auto-confirm routine failed: {e}")
        errors.append(f"Auto-confirm failed: {e}")
        tasks_run.append(f"自動確認執行異常：{e}")

    # 任務 B：惰性衰退檢查（僅在 decay_enabled=true 時實際扣分）
    decay_count = 0
    decay_skipped = False
    try:
        decay_res = _apply_decay(get_session, force=False)
        decay_count = int(decay_res.get("decayed_count", 0))
        decay_skipped = bool(decay_res.get("skipped", False))
        if decay_skipped:
            tasks_run.append("惰性衰退已關閉，略過檢查")
        else:
            tasks_run.append(f"惰性衰退檢查完成（套用 {decay_count} 人）")
    except Exception as e:
        logger.error(f"Decay check failed: {e}")
        errors.append(f"Decay failed: {e}")
        tasks_run.append(f"惰性衰退執行異常：{e}")

    # 任務 C：賽季到期提醒檢查（唯讀提示，正式結算交由管理員觸發）
    season_notice: str | None = None
    try:
        active_season = get_current_season(session)
        if is_season_expired(active_season, now):
            season_notice = f"賽季「{active_season.name}」已達截止時間，等待管理員正式結算"
            tasks_run.append(season_notice)
        elif active_season:
            tasks_run.append(f"當前賽季「{active_season.name}」運作中")
        else:
            tasks_run.append("目前為休賽季")
    except Exception as e:
        logger.error(f"Season status check failed: {e}")
        errors.append(f"Season check failed: {e}")

    duration_ms = round((time.perf_counter() - start_ts) * 1000)
    status_val = "partial_error" if errors else "success"

    summary_payload = {
        "status": status_val,
        "trigger": trigger,
        "ran_at": now.isoformat(),
        "duration_ms": duration_ms,
        "auto_confirmed_count": auto_confirmed_count,
        "auto_confirm_threshold": auto_confirm_val,
        "auto_confirm_unit": auto_confirm_unit,
        "decay_count": decay_count,
        "decay_skipped": decay_skipped,
        "season_notice": season_notice,
        "tasks_run": tasks_run,
        "errors": errors,
    }

    set_config_value(session, "last_cron_run_at", now.isoformat(), "最近一次排程執行時間")
    set_config_value(
        session,
        "last_cron_summary",
        json.dumps(summary_payload, ensure_ascii=False),
        "最近一次排程執行結果摘要",
    )
    session.commit()
    return summary_payload


@router.api_route(
    "/api/internal/cron/run-tasks",
    methods=["GET", "POST"],
    summary="執行背景排程任務（超時比賽自動確認 ＋ 可選惰性衰退檢查）",
)
def run_scheduled_tasks(
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    valid_secrets = settings.effective_cron_secrets
    candidate = None
    if authorization and authorization.startswith("Bearer "):
        candidate = authorization[len("Bearer "):].strip()
    elif x_cron_secret:
        candidate = x_cron_secret.strip()

    if not candidate or not any(hmac.compare_digest(candidate, secret) for secret in valid_secrets):
        raise HTTPException(status_code=401, detail="Unauthorized execution: Invalid secret key")

    payload = execute_cron_tasks(session, trigger="vercel_cron")
    return {
        "status": payload["status"],
        "timestamp": payload["ran_at"],
        "tasks_run": payload["tasks_run"],
        "summary": payload,
    }
