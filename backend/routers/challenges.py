from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlmodel import Session, or_, select

from database import get_session
from models import MatchChallenge, Notification, User, utc_now
from schemas import (
    ChallengeAcceptReq,
    ChallengeCounterReq,
    ChallengeCreateReq,
    ChallengeDeclineReq,
)
from services.auth_jwt import get_current_user
from services.challenge_service import (
    ensure_challenge_table,
    format_challenge_time_tw,
    serialize_challenges,
    sync_stale_challenges,
)
from services.season_service import ensure_utc

router = APIRouter(tags=["Challenges"])

MAX_OUTGOING_PENDING_CHALLENGES = 5
MAX_ADVANCE_DAYS = 30
ACTIVE_CHALLENGE_STATUSES = ("pending", "countered", "accepted")


def _clean_optional_text(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:max_len]


def _validate_active_player(session: Session, user_id: UUID, label: str) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"找不到{label}")
    if not user.is_active:
        raise HTTPException(status_code=400, detail=f"{label}（{user.name}）帳號目前未啟用，無法約戰")
    if user.role == "guest":
        raise HTTPException(status_code=400, detail=f"訪客帳號無法參與約戰")
    return user


def _validate_proposed_time(proposed_at: datetime) -> datetime:
    proposed_utc = ensure_utc(proposed_at)
    if proposed_utc is None:
        raise HTTPException(status_code=422, detail="請選擇有效的約戰日期與時間")
    now_utc = utc_now()
    if proposed_utc < now_utc - timedelta(minutes=2):
        raise HTTPException(status_code=422, detail="約戰時間不可早於現在")
    if proposed_utc > now_utc + timedelta(days=MAX_ADVANCE_DAYS):
        raise HTTPException(status_code=422, detail=f"約戰時間僅可預約未來 {MAX_ADVANCE_DAYS} 天內")
    return proposed_utc


def _emit_challenge_notifications(
    session: Session,
    recipients: list[UUID | None],
    notif_type: str,
    content: str,
) -> None:
    seen: set[UUID] = set()
    for uid in recipients:
        if uid is None or uid in seen:
            continue
        seen.add(uid)
        session.add(
            Notification(
                user_id=uid,
                match_id=None,
                type=notif_type,
                content=content,
                is_read=False,
            )
        )


def _get_other_representative(ch: MatchChallenge, caller_id: UUID) -> UUID:
    return ch.challenged_id if caller_id == ch.challenger_id else ch.challenger_id


@router.get("/api/challenges/mine", summary="取得我的進行中約戰與近期戰帖紀錄")
def get_my_challenges(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    rows = session.exec(
        select(MatchChallenge)
        .where(
            or_(
                MatchChallenge.challenger_id == current_user.id,
                MatchChallenge.challenged_id == current_user.id,
                MatchChallenge.challenger_partner_id == current_user.id,
                MatchChallenge.challenged_partner_id == current_user.id,
            )
        )
        .order_by(MatchChallenge.updated_at.desc())
    ).all()

    cutoff = utc_now() - timedelta(days=14)
    active_raw: list[MatchChallenge] = []
    history_raw: list[MatchChallenge] = []

    for ch in rows:
        if ch.status in ACTIVE_CHALLENGE_STATUSES:
            active_raw.append(ch)
        else:
            updated_utc = ensure_utc(ch.updated_at)
            if updated_utc and updated_utc >= cutoff and len(history_raw) < 8:
                history_raw.append(ch)

    active_serialized = serialize_challenges(session, active_raw, viewer_id=current_user.id)
    active_serialized.sort(
        key=lambda item: (
            0 if item["awaiting_my_response"] else (1 if item["status"] == "accepted" else 2),
            item["proposed_at"] or "",
        )
    )
    history_serialized = serialize_challenges(session, history_raw, viewer_id=current_user.id)
    pending_response_count = sum(1 for item in active_serialized if item["awaiting_my_response"])

    return {
        "active": active_serialized,
        "history": history_serialized,
        "pending_response_count": pending_response_count,
    }


@router.get("/api/challenges/public", summary="取得社團近期公開約戰預告牆")
def get_public_upcoming_challenges(
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    window_start = utc_now() - timedelta(hours=2)
    rows = session.exec(
        select(MatchChallenge)
        .where(
            MatchChallenge.status == "accepted",
            MatchChallenge.is_public == True,
            MatchChallenge.proposed_at >= window_start,
        )
        .order_by(MatchChallenge.proposed_at.asc())
        .limit(6)
    ).all()

    return serialize_challenges(session, list(rows), viewer_id=None)


@router.post("/api/challenges", status_code=status.HTTP_201_CREATED, summary="向指定選手發起約戰挑戰")
def create_challenge(
    req: ChallengeCreateReq,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    if req.match_type not in ("singles", "doubles"):
        raise HTTPException(status_code=422, detail="賽制僅支援單打（singles）或雙打（doubles）")
    if req.format not in ("BO3", "BO5"):
        raise HTTPException(status_code=422, detail="局制僅支援 BO3 或 BO5")
    if req.challenged_id == current_user.id:
        raise HTTPException(status_code=422, detail="不能向自己發起挑戰")

    challenged_user = _validate_active_player(session, req.challenged_id, "受邀對手")
    proposed_utc = _validate_proposed_time(req.proposed_at)

    challenger_partner_id: UUID | None = None
    challenged_partner_id: UUID | None = None
    if req.match_type == "doubles":
        challenger_partner_id = req.challenger_partner_id
        challenged_partner_id = req.challenged_partner_id
        slot_ids = [
            uid
            for uid in (current_user.id, req.challenged_id, challenger_partner_id, challenged_partner_id)
            if uid is not None
        ]
        if len(set(slot_ids)) != len(slot_ids):
            raise HTTPException(status_code=422, detail="同一場雙打的成員不可重複")
        if challenger_partner_id is not None:
            _validate_active_player(session, challenger_partner_id, "我方搭檔")
        if challenged_partner_id is not None:
            _validate_active_player(session, challenged_partner_id, "對方搭檔")

    # 防重複：兩位代表之間同時只允許 1 筆進行中戰帖
    existing_between = session.exec(
        select(MatchChallenge).where(
            MatchChallenge.status.in_(list(ACTIVE_CHALLENGE_STATUSES)),
            or_(
                (MatchChallenge.challenger_id == current_user.id) & (MatchChallenge.challenged_id == req.challenged_id),
                (MatchChallenge.challenger_id == req.challenged_id) & (MatchChallenge.challenged_id == current_user.id),
            ),
        )
    ).first()
    if existing_between:
        raise HTTPException(
            status_code=409,
            detail=f"您與 {challenged_user.name} 之間已有進行中的約戰，請直接於首頁查看或處理",
        )

    outgoing_pending_count = len(
        session.exec(
            select(MatchChallenge).where(
                MatchChallenge.challenger_id == current_user.id,
                MatchChallenge.status.in_(["pending", "countered"]),
            )
        ).all()
    )
    if outgoing_pending_count >= MAX_OUTGOING_PENDING_CHALLENGES:
        raise HTTPException(
            status_code=400,
            detail=f"目前同時發出的待回應戰帖已達上限（{MAX_OUTGOING_PENDING_CHALLENGES} 筆），請先等對方回應或取消部分戰帖",
        )

    clean_location = _clean_optional_text(req.location, 80)
    clean_message = _clean_optional_text(req.message, 120)

    challenge = MatchChallenge(
        challenger_id=current_user.id,
        challenged_id=req.challenged_id,
        match_type=req.match_type,
        format=req.format,
        challenger_partner_id=challenger_partner_id,
        challenged_partner_id=challenged_partner_id,
        proposed_at=proposed_utc,
        proposed_by=current_user.id,
        location=clean_location,
        message=clean_message,
        status="pending",
        is_public=req.is_public,
    )
    session.add(challenge)
    session.flush()

    mode_label = "雙打" if req.match_type == "doubles" else "單打"
    time_str = format_challenge_time_tw(proposed_utc)
    note_suffix = f"：「{clean_message}」" if clean_message else "，請前往首頁選擇接戰或改約時間。"

    _emit_challenge_notifications(
        session,
        [req.challenged_id],
        "challenge_received",
        f"⚔️ {current_user.name} 向您發起{mode_label}挑戰（{req.format}），約定 {time_str}{note_suffix}",
    )

    if req.match_type == "doubles":
        partner_recipients = [
            uid for uid in (challenger_partner_id, challenged_partner_id) if uid and uid != current_user.id
        ]
        _emit_challenge_notifications(
            session,
            partner_recipients,
            "challenge_received",
            f"⚔️ {current_user.name} 發起雙打約戰（對象：{challenged_user.name}，預定 {time_str}），已先將您列為搭檔，待兩位代表確認時間。",
        )

    session.commit()
    session.refresh(challenge)
    return serialize_challenges(session, [challenge], viewer_id=current_user.id)[0]


@router.post("/api/challenges/{challenge_id}/accept", summary="接受挑戰並確認約戰時間")
def accept_challenge(
    challenge_id: UUID,
    req: ChallengeAcceptReq | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    ch = session.get(MatchChallenge, challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="找不到此約戰戰帖")
    if current_user.id not in (ch.challenger_id, ch.challenged_id):
        raise HTTPException(status_code=403, detail="只有約戰雙方代表可確認接受")
    if ch.status not in ("pending", "countered"):
        raise HTTPException(status_code=400, detail="此戰帖目前狀態無法執行接受操作")
    if ch.proposed_by == current_user.id:
        raise HTTPException(status_code=400, detail="已由您送出此時間提案，請等待對方回應")

    if (
        req is not None
        and req.challenged_partner_id is not None
        and ch.match_type == "doubles"
        and current_user.id == ch.challenged_id
    ):
        taken = {uid for uid in (ch.challenger_id, ch.challenged_id, ch.challenger_partner_id) if uid}
        if req.challenged_partner_id in taken:
            raise HTTPException(status_code=422, detail="搭檔人選不可與其他參賽者重複")
        _validate_active_player(session, req.challenged_partner_id, "受邀方搭檔")
        ch.challenged_partner_id = req.challenged_partner_id

    ch.status = "accepted"
    ch.updated_at = utc_now()
    session.add(ch)

    time_str = format_challenge_time_tw(ch.proposed_at)
    loc_suffix = f"（地點：{ch.location}）" if ch.location else ""
    recipients = [
        uid
        for uid in (ch.challenger_id, ch.challenged_id, ch.challenger_partner_id, ch.challenged_partner_id)
        if uid and uid != current_user.id
    ]
    _emit_challenge_notifications(
        session,
        recipients,
        "challenge_accepted",
        f"✅ {current_user.name} 已接下戰帖！約戰確定於 {time_str} 開打{loc_suffix}。",
    )

    session.commit()
    session.refresh(ch)
    return serialize_challenges(session, [ch], viewer_id=current_user.id)[0]


@router.post("/api/challenges/{challenge_id}/counter", summary="改約其他日期與時間")
def counter_challenge(
    challenge_id: UUID,
    req: ChallengeCounterReq,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    ch = session.get(MatchChallenge, challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="找不到此約戰戰帖")
    if current_user.id not in (ch.challenger_id, ch.challenged_id):
        raise HTTPException(status_code=403, detail="只有約戰雙方代表可提出改約時間")
    if ch.status not in ("pending", "countered"):
        raise HTTPException(status_code=400, detail="此戰帖目前狀態無法改約時間")
    if ch.proposed_by == current_user.id:
        raise HTTPException(status_code=400, detail="請先等待對方回應您上一輪提出的时间")

    proposed_utc = _validate_proposed_time(req.proposed_at)
    ch.proposed_at = proposed_utc
    ch.proposed_by = current_user.id
    ch.status = "countered"
    if req.location is not None:
        ch.location = _clean_optional_text(req.location, 80)
    if req.message is not None:
        ch.message = _clean_optional_text(req.message, 120)
    ch.updated_at = utc_now()
    session.add(ch)

    other_id = _get_other_representative(ch, current_user.id)
    time_str = format_challenge_time_tw(proposed_utc)
    note_suffix = f"：「{ch.message}」" if ch.message else "，請前往首頁確認是否接受。"
    _emit_challenge_notifications(
        session,
        [other_id],
        "challenge_countered",
        f"🕒 {current_user.name} 提出改約時間至 {time_str}{note_suffix}",
    )

    session.commit()
    session.refresh(ch)
    return serialize_challenges(session, [ch], viewer_id=current_user.id)[0]


@router.post("/api/challenges/{challenge_id}/decline", summary="婉拒挑戰邀請")
def decline_challenge(
    challenge_id: UUID,
    req: ChallengeDeclineReq | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    ch = session.get(MatchChallenge, challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="找不到此約戰戰帖")
    if current_user.id not in (ch.challenger_id, ch.challenged_id):
        raise HTTPException(status_code=403, detail="只有約戰雙方代表可婉拒戰帖")
    if ch.status not in ("pending", "countered"):
        raise HTTPException(status_code=400, detail="此戰帖目前狀態無法婉拒")
    if ch.proposed_by == current_user.id:
        raise HTTPException(status_code=400, detail="自己提出的時間請使用取消戰帖")

    reason = _clean_optional_text(req.reason if req else None, 100)
    ch.status = "declined"
    ch.decline_reason = reason
    ch.updated_at = utc_now()
    session.add(ch)

    other_id = _get_other_representative(ch, current_user.id)
    reason_suffix = f"（原因：{reason}）" if reason else ""
    _emit_challenge_notifications(
        session,
        [other_id],
        "challenge_declined",
        f"💬 {current_user.name} 暫時無法應戰此次約戰邀請{reason_suffix}。",
    )

    session.commit()
    session.refresh(ch)
    return serialize_challenges(session, [ch], viewer_id=current_user.id)[0]


@router.post("/api/challenges/{challenge_id}/cancel", summary="取消尚未開打報分的戰帖")
def cancel_challenge(
    challenge_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    ch = session.get(MatchChallenge, challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="找不到此約戰戰帖")
    if current_user.id not in (ch.challenger_id, ch.challenged_id):
        raise HTTPException(status_code=403, detail="只有約戰雙方代表可取消戰帖")
    if ch.status not in ACTIVE_CHALLENGE_STATUSES:
        raise HTTPException(status_code=400, detail="此戰帖已結束或已取消")
    if (ch.reported_matches_count or 0) > 0:
        raise HTTPException(status_code=400, detail="此約戰已有報分紀錄，請改點「結束約戰」完成歸檔")

    was_accepted = ch.status == "accepted"
    ch.status = "cancelled"
    ch.updated_at = utc_now()
    session.add(ch)

    recipients: list[UUID | None] = [_get_other_representative(ch, current_user.id)]
    if was_accepted:
        recipients.extend([ch.challenger_partner_id, ch.challenged_partner_id])
    recipients = [uid for uid in recipients if uid and uid != current_user.id]

    time_str = format_challenge_time_tw(ch.proposed_at)
    _emit_challenge_notifications(
        session,
        recipients,
        "challenge_cancelled",
        f"🚫 {current_user.name} 已取消原定 {time_str} 的約戰戰帖。",
    )

    session.commit()
    session.refresh(ch)
    return serialize_challenges(session, [ch], viewer_id=current_user.id)[0]


@router.post("/api/challenges/{challenge_id}/complete", summary="結束本次約戰並歸檔")
def complete_challenge(
    challenge_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ensure_challenge_table()
    sync_stale_challenges(session)

    ch = session.get(MatchChallenge, challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="找不到此約戰戰帖")
    if current_user.id not in (ch.challenger_id, ch.challenged_id):
        raise HTTPException(status_code=403, detail="只有約戰雙方代表可結束約戰")
    if ch.status != "accepted":
        raise HTTPException(status_code=400, detail="僅已成立的約戰可標記為結束")

    ch.status = "completed"
    ch.updated_at = utc_now()
    session.add(ch)
    session.commit()
    session.refresh(ch)
    return serialize_challenges(session, [ch], viewer_id=current_user.id)[0]
