"""
services/challenge_service.py

約戰／發起挑戰資料表備妥、逾期自動歸檔同步與序列化輔助工具。
"""
import threading
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlmodel import Session, select

from database import engine
from models import MatchChallenge, User, utc_now
from services.season_service import ensure_utc

TW_TZ = timezone(timedelta(hours=8))

_challenge_table_ready = False
_challenge_table_lock = threading.Lock()


def ensure_challenge_table() -> None:
    """確保 MatchChallenge 資料表已建立（Serverless 環境免手動遷移保護）。"""
    global _challenge_table_ready
    if _challenge_table_ready:
        return
    with _challenge_table_lock:
        if _challenge_table_ready:
            return
        MatchChallenge.__table__.create(bind=engine, checkfirst=True)
        _challenge_table_ready = True


def format_challenge_time_tw(dt: datetime) -> str:
    """將 UTC 時間轉為台灣時間（MM/dd HH:mm）供站內通知顯示。"""
    dt_utc = ensure_utc(dt)
    if dt_utc is None:
        return ""
    return dt_utc.astimezone(TW_TZ).strftime("%m/%d %H:%M")


def sync_stale_challenges(session: Session) -> None:
    """
    將超過約定時間的未回應戰帖標記為過期；
    已成立約戰在約定時間超過 24 小時後自動歸檔為已完賽或過期。
    """
    now_utc = utc_now()
    active_rows = session.exec(
        select(MatchChallenge).where(
            MatchChallenge.status.in_(["pending", "countered", "accepted"])
        )
    ).all()

    dirty = False
    for ch in active_rows:
        proposed_utc = ensure_utc(ch.proposed_at)
        if proposed_utc is None:
            continue
        if ch.status in ("pending", "countered"):
            if proposed_utc < now_utc:
                ch.status = "expired"
                ch.updated_at = now_utc
                session.add(ch)
                dirty = True
        elif ch.status == "accepted":
            if proposed_utc + timedelta(hours=24) < now_utc:
                ch.status = "completed" if (ch.reported_matches_count or 0) > 0 else "expired"
                ch.updated_at = now_utc
                session.add(ch)
                dirty = True

    if dirty:
        session.commit()


def _serialize_player(user_map: dict[UUID, User], uid: UUID | None) -> dict | None:
    if uid is None:
        return None
    u = user_map.get(uid)
    if not u:
        return None
    return {
        "id": str(u.id),
        "name": u.name,
        "avatar": u.avatar_url,
        "department": u.department,
        "mmr": round(u.global_mmr),
    }


def _build_report_prefill(ch: MatchChallenge, viewer_id: UUID | None) -> dict | None:
    if viewer_id is None:
        return None

    if viewer_id == ch.challenger_id:
        my_partner = ch.challenger_partner_id
        opp1 = ch.challenged_id
        opp2 = ch.challenged_partner_id
    elif viewer_id == ch.challenger_partner_id:
        my_partner = ch.challenger_id
        opp1 = ch.challenged_id
        opp2 = ch.challenged_partner_id
    elif viewer_id == ch.challenged_id:
        my_partner = ch.challenged_partner_id
        opp1 = ch.challenger_id
        opp2 = ch.challenger_partner_id
    elif viewer_id == ch.challenged_partner_id:
        my_partner = ch.challenged_id
        opp1 = ch.challenger_id
        opp2 = ch.challenger_partner_id
    else:
        return None

    is_doubles = ch.match_type == "doubles"
    return {
        "match_type": ch.match_type,
        "format": ch.format,
        "partner_id": str(my_partner) if (is_doubles and my_partner) else None,
        "opponent1_id": str(opp1) if opp1 else None,
        "opponent2_id": str(opp2) if (is_doubles and opp2) else None,
    }


def serialize_challenges(
    session: Session,
    challenges: list[MatchChallenge],
    viewer_id: UUID | None = None,
) -> list[dict]:
    """批次載入相關選手資訊並序列化戰帖清單（零 N+1 查詢）。"""
    if not challenges:
        return []

    user_ids: set[UUID] = set()
    for ch in challenges:
        for uid in (
            ch.challenger_id,
            ch.challenged_id,
            ch.challenger_partner_id,
            ch.challenged_partner_id,
        ):
            if uid is not None:
                user_ids.add(uid)

    user_map: dict[UUID, User] = {}
    if user_ids:
        rows = session.exec(select(User).where(User.id.in_(list(user_ids)))).all()
        user_map = {u.id: u for u in rows}

    results: list[dict] = []
    for ch in challenges:
        proposed_utc = ensure_utc(ch.proposed_at)
        created_utc = ensure_utc(ch.created_at)
        updated_utc = ensure_utc(ch.updated_at)

        my_role: str | None = None
        if viewer_id == ch.challenger_id:
            my_role = "challenger"
        elif viewer_id == ch.challenged_id:
            my_role = "challenged"
        elif ch.challenger_partner_id and viewer_id == ch.challenger_partner_id:
            my_role = "challenger_partner"
        elif ch.challenged_partner_id and viewer_id == ch.challenged_partner_id:
            my_role = "challenged_partner"

        is_representative = viewer_id is not None and viewer_id in (ch.challenger_id, ch.challenged_id)
        awaiting_my_response = bool(
            is_representative
            and ch.status in ("pending", "countered")
            and ch.proposed_by != viewer_id
        )
        can_cancel = bool(
            is_representative
            and ch.status in ("pending", "countered", "accepted")
            and (ch.reported_matches_count or 0) == 0
        )
        can_report = bool(ch.status == "accepted" and my_role is not None)
        can_complete = bool(ch.status == "accepted" and is_representative)

        results.append({
            "id": str(ch.id),
            "match_type": ch.match_type,
            "format": ch.format,
            "status": ch.status,
            "proposed_at": proposed_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if proposed_utc else None,
            "proposed_by": str(ch.proposed_by),
            "location": ch.location,
            "message": ch.message,
            "decline_reason": ch.decline_reason,
            "is_public": ch.is_public,
            "reported_matches_count": ch.reported_matches_count or 0,
            "last_match_id": str(ch.last_match_id) if ch.last_match_id else None,
            "created_at": created_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if created_utc else None,
            "updated_at": updated_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if updated_utc else None,
            "challenger": _serialize_player(user_map, ch.challenger_id),
            "challenged": _serialize_player(user_map, ch.challenged_id),
            "challenger_partner": _serialize_player(user_map, ch.challenger_partner_id),
            "challenged_partner": _serialize_player(user_map, ch.challenged_partner_id),
            "my_role": my_role,
            "is_representative": is_representative,
            "awaiting_my_response": awaiting_my_response,
            "can_accept": awaiting_my_response,
            "can_counter": awaiting_my_response,
            "can_decline": awaiting_my_response,
            "can_cancel": can_cancel,
            "can_report": can_report,
            "can_complete": can_complete,
            "report_prefill": _build_report_prefill(ch, viewer_id),
        })

    return results
