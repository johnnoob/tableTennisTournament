from datetime import datetime, timezone
import logging
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import Match, MatchParticipation, Notification, PlayerStatHistory, SystemConfig, User
from services.elo_engine import ELO_CONFIG
from services.season_service import ensure_utc, get_config_value

logger = logging.getLogger(__name__)

_scheduler = None


def _resolve_decay_params(session: Session) -> tuple[bool, int, int, float, str]:
    """讀取目前生效中的惰性衰退參數設定。"""
    enabled = get_config_value(session, "decay_enabled", "false").lower() == "true"

    if settings.cron_test_mode:
        threshold_val = settings.decay_threshold_value
        cycle_val = settings.decay_cycle_value
        decay_amount = float(settings.decay_amount)
        time_unit = "minutes"
    else:
        threshold_val = int(get_config_value(session, "decay_days_threshold", str(settings.decay_threshold_value)))
        cycle_val = int(get_config_value(session, "decay_cycle_days", str(settings.decay_cycle_value)))
        decay_amount = float(get_config_value(session, "decay_amount", str(settings.decay_amount)))
        time_unit = "days"

    return enabled, threshold_val, cycle_val, decay_amount, time_unit


def _find_decay_candidates(session: Session, now: datetime) -> tuple[dict, list[tuple[User, float, float, float, float]]]:
    """計算符合閒置扣分條件的活躍玩家清單（唯讀查詢，不改動資料庫）。"""
    enabled, threshold_val, cycle_val, decay_amount, time_unit = _resolve_decay_params(session)
    mmr_floor = float(ELO_CONFIG.get("MIN_MMR_FLOOR", 600.0))

    meta = {
        "decay_enabled": enabled,
        "cron_test_mode": settings.cron_test_mode,
        "time_unit": time_unit,
        "threshold": threshold_val,
        "cycle": cycle_val,
        "amount": decay_amount,
    }

    active_users = session.exec(
        select(User).where(User.is_active == True, User.role != "guest")
    ).all()

    # 批次撈取已確認比賽的最近出賽時間，避免 UUID DESC 排序誤判與 N+1 查詢
    rows = session.exec(
        select(MatchParticipation.user_id, Match.created_at)
        .join(Match, MatchParticipation.match_id == Match.id)
        .where(Match.status.in_(["confirmed", "completed"]))
        .order_by(Match.created_at.desc())
    ).all()

    latest_played_map: dict = {}
    for uid, created_at in rows:
        if uid not in latest_played_map:
            latest_played_map[uid] = ensure_utc(created_at)

    candidates: list[tuple[User, float, float, float, float]] = []
    for user in active_users:
        last_played = latest_played_map.get(user.id)
        if not last_played:
            continue

        time_diff = now - last_played
        current_inactive = (
            time_diff.total_seconds() / 60
            if time_unit == "minutes"
            else time_diff.total_seconds() / 86400
        )

        if current_inactive < threshold_val:
            continue

        should_decay = False
        if user.last_decay_date is None:
            should_decay = True
        else:
            last_decay = ensure_utc(user.last_decay_date)
            decay_diff = now - last_decay
            elapsed_since_decay = (
                decay_diff.total_seconds() / 60
                if time_unit == "minutes"
                else decay_diff.total_seconds() / 86400
            )
            if elapsed_since_decay >= cycle_val:
                should_decay = True

        if not should_decay:
            continue

        old_mmr = float(user.global_mmr)
        new_mmr = max(old_mmr - decay_amount, mmr_floor)
        actual_diff = new_mmr - old_mmr
        if actual_diff < 0:
            candidates.append((user, old_mmr, new_mmr, abs(actual_diff), current_inactive))

    return meta, candidates


def preview_decay(session: Session) -> dict:
    """提供管理員執行惰性衰退前的乾跑預覽名單。"""
    now = datetime.now(timezone.utc)
    meta, candidates = _find_decay_candidates(session, now)

    affected_users = [
        {
            "user_id": str(user.id),
            "name": user.name,
            "department": user.department,
            "avatar_url": user.avatar_url,
            "current_mmr": round(old_mmr, 1),
            "projected_mmr": round(new_mmr, 1),
            "deduction": round(deduction, 1),
            "inactive_value": int(current_inactive),
        }
        for user, old_mmr, new_mmr, deduction, current_inactive in candidates
    ]

    return {
        **meta,
        "affected_count": len(affected_users),
        "affected_users": affected_users,
    }


def _apply_decay(session_factory, force: bool = False) -> dict:
    """
    實施「惰性衰退」扣分邏輯。
    - force=False（例行 Cron）：若後台未開啟 decay_enabled，則跳過執行。
    - force=True（管理員手動觸發）：直接依目前參數執行一次。
    """
    generator = session_factory()
    session = next(generator)
    try:
        now = datetime.now(timezone.utc)
        meta, candidates = _find_decay_candidates(session, now)

        if not force and not meta["decay_enabled"]:
            return {
                "skipped": True,
                "decayed_count": 0,
                "time_unit": meta["time_unit"],
                "amount": meta["amount"],
                "reason": "惰性衰退機制目前為關閉狀態",
            }

        decayed_count = 0
        unit_zh = "分鐘" if meta["time_unit"] == "minutes" else "天"
        for user, old_mmr, new_mmr, deduction, current_inactive in candidates:
            user.global_mmr = new_mmr
            user.last_decay_date = now
            session.add(user)

            session.add(PlayerStatHistory(
                user_id=user.id,
                mmr=new_mmr,
                recorded_at=now,
                event_type="decay",
            ))

            session.add(Notification(
                user_id=user.id,
                type="match_rejected",
                content=f"由於您已連續 {int(current_inactive)} {unit_zh} 未出賽，系統已自動扣除 {deduction:.1f} MMR。",
                created_at=now,
            ))

            decayed_count += 1
            logger.info(
                f"[Decay] {user.name}: {old_mmr:.1f} -> {new_mmr:.1f} (inactive: {current_inactive:.1f} {meta['time_unit']})"
            )

        session.commit()
        if decayed_count:
            logger.info(f"[Decay] Success: Applied decay to {decayed_count} user(s).")

        return {
            "skipped": False,
            "decayed_count": decayed_count,
            "time_unit": meta["time_unit"],
            "amount": meta["amount"],
        }
    except Exception as e:
        session.rollback()
        logger.error(f"[Decay] CRITICAL ERROR: {str(e)}")
        raise
    finally:
        session.close()


def setup_scheduler():
    """
    本地開發模式排程器：僅保留惰性衰退檢查（賽季起訖交由管理員控制）。
    """
    global _scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.interval import IntervalTrigger

    if _scheduler is None:
        _scheduler = AsyncIOScheduler()

    decay_trigger = IntervalTrigger(minutes=5) if settings.cron_test_mode else IntervalTrigger(hours=12)

    _scheduler.add_job(
        _apply_decay,
        trigger=decay_trigger,
        args=[get_session],
        id="auto_decay_job",
        replace_existing=True,
    )

    logger.info(f"[APScheduler] Initialization complete. Local Scheduler: {settings.enable_local_scheduler}")
    return _scheduler


def shutdown_scheduler():
    """關閉本地 APScheduler 實例。"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown()
        _scheduler = None
