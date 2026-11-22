from datetime import datetime, timedelta, timezone
import logging
from sqlmodel import Session, select
from models import (
    Match,
    MatchParticipation,
    Notification,
    PlayerStatHistory,
    Season,
    SeasonRecord,
    SystemConfig,
    User,
    utc_now,
)
from services.elo_engine import ELO_CONFIG

logger = logging.getLogger(__name__)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """確保 datetime 對象帶有 UTC 時區資訊，若為 naive 則補上 UTC。"""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_config_value(session: Session, key: str, default: str) -> str:
    config = session.get(SystemConfig, key)
    return config.value if config else default


def set_config_value(
    session: Session,
    key: str,
    value: str,
    description: str | None = None,
    commit: bool = False,
) -> SystemConfig:
    config = session.get(SystemConfig, key)
    now = utc_now()
    if not config:
        config = SystemConfig(
            key=key,
            value=value,
            description=description,
            updated_at=now,
        )
        session.add(config)
    else:
        config.value = value
        if description is not None:
            config.description = description
        config.updated_at = now
        session.add(config)
    if commit:
        session.commit()
        session.refresh(config)
    return config


def is_season_paused(session: Session) -> bool:
    val = get_config_value(session, "season_paused", "false")
    return val.lower() == "true"


def is_lock_on_expire_enabled(session: Session) -> bool:
    val = get_config_value(session, "season_lock_on_expire", "true")
    return val.lower() == "true"


def is_season_expired(season: Season | None, now: datetime | None = None) -> bool:
    if not season or not season.end_date:
        return False
    check_now = ensure_utc(now) or utc_now()
    end_utc = ensure_utc(season.end_date)
    return bool(end_utc is not None and end_utc <= check_now)


def get_current_season(session: Session) -> Season | None:
    """
    取得目前狀態為 active 的最新賽季。
    注意：不會在讀取時擅自把過期賽季改為 completed，也不因暫停報分而隱藏賽季；
    報分限制（暫停或到期鎖定）由報分路由明確檢查與提示。
    """
    statement = (
        select(Season)
        .where(Season.status == "active")
        .order_by(Season.start_date.desc())
    )
    return session.exec(statement).first()


def _generate_next_season_id(session: Session) -> str:
    existing_ids = {s.id for s in session.exec(select(Season)).all()}
    idx = len(existing_ids)
    while f"S{idx}" in existing_ids:
        idx += 1
    return f"S{idx}"


def soft_reset_all_users_mmr(session: Session, commit: bool = True) -> int:
    """
    執行「軟重置」：將所有活躍非訪客玩家的 global_mmr 向基準分回歸。
    公式：new_mmr = (current_mmr + DEFAULT_BASE_MMR) / 2
    """
    baseline = ELO_CONFIG["DEFAULT_BASE_MMR"]

    statement = select(User).where(User.is_active == True, User.role != "guest")
    active_users = session.exec(statement).all()

    updated_count = 0
    for user in active_users:
        user.global_mmr = (user.global_mmr + baseline) / 2
        session.add(user)

        reset_history = PlayerStatHistory(
            user_id=user.id,
            match_id=None,
            mmr=user.global_mmr,
            event_type="soft_reset",
        )
        session.add(reset_history)
        updated_count += 1

    if commit:
        session.commit()

    logger.info(
        f"[SoftReset] Regressed active users' MMR toward {baseline}. Rows affected: {updated_count}"
    )
    return updated_count


def create_manual_season(
    session: Session,
    name: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> Season:
    """管理員於休賽季手動建立並啟動新賽季。"""
    existing_active = get_current_season(session)
    if existing_active:
        raise ValueError(f"目前已有進行中的賽季「{existing_active.name}」，請使用結算／換季流程。")

    clean_name = name.strip()
    if not clean_name:
        raise ValueError("賽季名稱不可為空")

    start_utc = ensure_utc(start_date) or utc_now()
    end_utc = ensure_utc(end_date)
    if end_utc is not None and end_utc <= start_utc:
        raise ValueError("結束時間必須晚於開始時間")

    new_season = Season(
        id=_generate_next_season_id(session),
        name=clean_name,
        status="active",
        start_date=start_utc,
        end_date=end_utc,
    )
    session.add(new_season)
    session.commit()
    session.refresh(new_season)
    return new_season


def update_season_details(
    session: Session,
    season_id: str,
    name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    clear_end_date: bool = False,
) -> Season:
    """管理員更新指定賽季的名稱或起訖時間（不再被排程覆蓋）。"""
    season = session.get(Season, season_id)
    if not season:
        raise LookupError("找不到指定的賽季")

    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("賽季名稱不可為空")
        season.name = clean_name

    next_start = ensure_utc(start_date) if start_date is not None else ensure_utc(season.start_date)
    if clear_end_date:
        next_end = None
    elif end_date is not None:
        next_end = ensure_utc(end_date)
    else:
        next_end = ensure_utc(season.end_date)

    if next_start and next_end and next_end <= next_start:
        raise ValueError("結束時間必須晚於開始時間")

    if next_start is not None:
        season.start_date = next_start
    season.end_date = next_end

    session.add(season)
    session.commit()
    session.refresh(season)
    return season


def _snapshot_season_records(session: Session, season: Season, now: datetime) -> None:
    """結算賽季時，為所有參賽玩家寫入 final_mmr 快照並補齊缺少的 SeasonRecord。"""
    existing_records = session.exec(
        select(SeasonRecord).where(SeasonRecord.season_id == season.id)
    ).all()
    record_by_user = {r.user_id: r for r in existing_records}

    # 若有已結算比賽但缺乏 SeasonRecord 的玩家，先補齊戰績統計
    settled_matches = session.exec(
        select(Match).where(
            Match.season_id == season.id,
            Match.status.in_(["confirmed", "completed"]),
        )
    ).all()

    match_counts: dict = {}
    for m in settled_matches:
        a_won = m.score_a > m.score_b
        for uid in (m.team_a_p1_id, m.team_a_p2_id):
            if uid is not None:
                entry = match_counts.setdefault(uid, {"played": 0, "wins": 0})
                entry["played"] += 1
                if a_won:
                    entry["wins"] += 1
        for uid in (m.team_b_p1_id, m.team_b_p2_id):
            if uid is not None:
                entry = match_counts.setdefault(uid, {"played": 0, "wins": 0})
                entry["played"] += 1
                if not a_won:
                    entry["wins"] += 1

    for uid, counts in match_counts.items():
        if uid not in record_by_user:
            rec = SeasonRecord(
                user_id=uid,
                season_id=season.id,
                matches_played=counts["played"],
                wins=counts["wins"],
            )
            session.add(rec)
            record_by_user[uid] = rec

    for uid, record in record_by_user.items():
        user = session.get(User, uid)
        if user:
            record.final_mmr = user.global_mmr
            session.add(record)

    season.status = "completed"
    if not season.end_date or (ensure_utc(season.end_date) and ensure_utc(season.end_date) > now):
        season.end_date = now
    session.add(season)


def settle_and_rollover_season(
    session: Session,
    new_name: str | None = None,
    new_start_date: datetime | None = None,
    new_end_date: datetime | None = None,
    apply_soft_reset: bool = True,
    start_new_season: bool = True,
) -> dict:
    """
    管理員一鍵結算當前進行中賽季，視設定執行積分軟重置並開啟下一季。
    全程在單一資料庫交易內原子完成。
    """
    now = utc_now()
    active_seasons = session.exec(
        select(Season).where(Season.status == "active").order_by(Season.start_date.desc())
    ).all()

    if not active_seasons:
        raise ValueError("目前沒有進行中的賽季可結算")

    settled_ids: list[str] = []
    for old_season in active_seasons:
        _snapshot_season_records(session, old_season, now)
        settled_ids.append(old_season.id)

    soft_reset_count = 0
    if apply_soft_reset:
        soft_reset_count = soft_reset_all_users_mmr(session, commit=False)

    new_season_data = None
    if start_new_season:
        total_seasons = len(session.exec(select(Season)).all())
        clean_name = (new_name or f"正式賽季 #{total_seasons + 1}").strip()
        if not clean_name:
            raise ValueError("新賽季名稱不可為空")

        start_utc = ensure_utc(new_start_date) or now
        end_utc = ensure_utc(new_end_date)
        if end_utc is not None and end_utc <= start_utc:
            raise ValueError("新賽季結束時間必須晚於開始時間")

        new_season = Season(
            id=_generate_next_season_id(session),
            name=clean_name,
            status="active",
            start_date=start_utc,
            end_date=end_utc,
        )
        session.add(new_season)
        session.flush()
        new_season_data = {
            "id": new_season.id,
            "name": new_season.name,
            "status": new_season.status,
            "start_date": new_season.start_date,
            "end_date": new_season.end_date,
        }

    for old_season in active_seasons:
        records = session.exec(
            select(SeasonRecord).where(
                SeasonRecord.season_id == old_season.id,
                SeasonRecord.matches_played > 0,
            )
        ).all()
        sorted_records = sorted(
            records,
            key=lambda r: float(r.final_mmr if r.final_mmr is not None else 1000.0),
            reverse=True,
        )
        next_clause = (
            f"（新賽季「{new_season_data['name']}」已正式開打）"
            if new_season_data
            else ""
        )
        for idx, rec in enumerate(sorted_records):
            u = session.get(User, rec.user_id)
            if not u or not u.is_active or u.role == "guest":
                continue
            final_score = round(
                float(rec.final_mmr if rec.final_mmr is not None else u.global_mmr)
            )
            new_score = round(float(u.global_mmr))
            losses = max(0, rec.matches_played - rec.wins)
            reset_clause = (
                f"，新季軟重置起始積分為 {new_score} ELO"
                if apply_soft_reset
                else ""
            )
            session.add(
                Notification(
                    user_id=u.id,
                    match_id=None,
                    type="match_confirmed",
                    content=(
                        f"🏆 賽季「{old_season.name}」已正式結算！您本季排名第 {idx + 1} 名，"
                        f"最終積分 {final_score} ELO（戰績 {rec.wins}勝{losses}敗）"
                        f"{reset_clause}{next_clause}。"
                    ),
                    created_at=now,
                )
            )

    session.commit()
    return {
        "settled_season_ids": settled_ids,
        "soft_reset_count": soft_reset_count,
        "new_season": new_season_data,
    }


def ensure_current_quarter_season(session: Session) -> Season | None:
    """
    非破壞性啟動預檢：
    - 若資料庫已存在賽季（無論自訂名稱或日期為何），絕不覆蓋或自動重置，直接回傳進行中賽季（若有）。
    - 僅當全新空白資料庫（0 個賽季）時，自動初始化第一個預設賽季，方便開箱即用。
    """
    active = get_current_season(session)
    if active:
        return active

    any_season = session.exec(select(Season).limit(1)).first()
    if any_season:
        return None

    now = utc_now()
    default_days = int(get_config_value(session, "season_interval_days", "90") or "90")
    end_dt = now + timedelta(days=max(1, default_days))

    initial_season = Season(
        id="S0",
        name="正式賽季 #1",
        status="active",
        start_date=now,
        end_date=end_dt,
    )
    session.add(initial_season)
    session.commit()
    session.refresh(initial_season)
    return initial_season
