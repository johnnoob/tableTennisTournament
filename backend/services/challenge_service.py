"""
services/challenge_service.py

約戰／發起挑戰資料表備妥、逾期自動歸檔同步與序列化輔助工具。
"""
import threading
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlmodel import Session, or_, select

from database import engine, ensure_match_challenge_column
from models import Match, MatchChallenge, User, utc_now
from services.season_service import ensure_utc

TW_TZ = timezone(timedelta(hours=8))

_challenge_table_ready = False
_challenge_table_lock = threading.Lock()


def ensure_challenge_table() -> None:
    """確保 MatchChallenge 資料表與 Match.challenge_id 欄位已建立（Serverless 環境免手動遷移保護）。"""
    global _challenge_table_ready
    if _challenge_table_ready:
        return
    with _challenge_table_lock:
        if _challenge_table_ready:
            return
        MatchChallenge.__table__.create(bind=engine, checkfirst=True)
        ensure_match_challenge_column(engine)
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


def _serialize_challenge_match_player(user_map: dict[UUID, User], uid: UUID | None) -> dict | None:
    return _serialize_player(user_map, uid)


def _match_participants_fit_challenge(m: Match, ch: MatchChallenge) -> bool:
    """檢查 Match 的雙方參賽陣容是否符合約戰戰帖之對陣組合（支援單雙打及現場湊咖）。"""
    team_a_ids = {uid for uid in (m.team_a_p1_id, m.team_a_p2_id) if uid is not None}
    team_b_ids = {uid for uid in (m.team_b_p1_id, m.team_b_p2_id) if uid is not None}

    if ch.challenger_id in team_a_ids and ch.challenged_id in team_b_ids:
        challenger_team, challenged_team = team_a_ids, team_b_ids
    elif ch.challenger_id in team_b_ids and ch.challenged_id in team_a_ids:
        challenger_team, challenged_team = team_b_ids, team_a_ids
    else:
        return False

    if ch.challenger_partner_id is not None and ch.challenger_partner_id not in challenger_team:
        return False
    if ch.challenged_partner_id is not None and ch.challenged_partner_id not in challenged_team:
        return False
    return True


def _resolve_and_serialize_challenge_matches(
    session: Session,
    challenges: list[MatchChallenge],
    user_map: dict[UUID, User],
) -> tuple[dict[UUID, list[dict]], bool]:
    """
    查詢每筆戰帖已報分的實際 Match 場次，並對尚未標記 challenge_id 的歷史戰帖依 last_match_id 進行確定性回溯綁定。
    回傳 `(challenge_id -> serialized_matches, dirty_flag)`（由呼叫端統一 commit 以避免 session 提前 expire）。
    """
    with_matches = [
        ch
        for ch in challenges
        if (ch.reported_matches_count or 0) > 0 or ch.last_match_id is not None
    ]
    if not with_matches:
        return {}, False

    challenge_ids = [ch.id for ch in with_matches]
    last_match_ids = [ch.last_match_id for ch in with_matches if ch.last_match_id is not None]

    filters = [Match.challenge_id.in_(challenge_ids)]
    if last_match_ids:
        filters.append(Match.id.in_(last_match_ids))

    direct_rows = session.exec(select(Match).where(or_(*filters))).all()
    direct_by_id: dict[UUID, Match] = {m.id: m for m in direct_rows}

    linked_by_ch: dict[UUID, dict[UUID, Match]] = {ch.id: {} for ch in with_matches}
    claimed_match_ids: set[UUID] = set()
    dirty = False

    # 先標記所有顯式關聯 (challenge_id) 與各戰帖的 last_match_id
    for m in direct_rows:
        claimed_match_ids.add(m.id)
        if m.challenge_id in linked_by_ch:
            linked_by_ch[m.challenge_id][m.id] = m

    for ch in with_matches:
        if ch.last_match_id and ch.last_match_id in direct_by_id:
            last_m = direct_by_id[ch.last_match_id]
            if last_m.challenge_id is None:
                last_m.challenge_id = ch.id
                session.add(last_m)
                dirty = True
            linked_by_ch[ch.id][last_m.id] = last_m
            claimed_match_ids.add(last_m.id)

    # 對既有資料尚缺場次的戰帖，依 anchor_end（last_match.created_at 或 updated_at）由舊到新回溯補齊
    incomplete: list[tuple[datetime, MatchChallenge]] = []
    min_ts = datetime(1970, 1, 1, tzinfo=timezone.utc)
    for ch in with_matches:
        target_count = ch.reported_matches_count or 0
        if len(linked_by_ch[ch.id]) < target_count:
            anchor_m = direct_by_id.get(ch.last_match_id) if ch.last_match_id else None
            anchor_end = (
                ensure_utc(anchor_m.created_at)
                if anchor_m is not None
                else ensure_utc(ch.updated_at) or ensure_utc(ch.created_at)
            )
            incomplete.append((anchor_end or min_ts, ch))

    if incomplete:
        incomplete.sort(key=lambda item: item[0])
        for anchor_end, ch in incomplete:
            target_count = ch.reported_matches_count or 0
            needed = target_count - len(linked_by_ch[ch.id])
            if needed <= 0:
                continue

            ch_created = ensure_utc(ch.created_at)
            candidates = session.exec(
                select(Match).where(
                    Match.match_type == ch.match_type,
                    Match.challenge_id.is_(None),
                    or_(
                        Match.team_a_p1_id.in_([ch.challenger_id, ch.challenged_id]),
                        Match.team_a_p2_id.in_([ch.challenger_id, ch.challenged_id]),
                    ),
                )
            ).all()

            eligible: list[tuple[datetime, Match]] = []
            for m in candidates:
                if m.id in claimed_match_ids:
                    continue
                if not _match_participants_fit_challenge(m, ch):
                    continue
                m_created = ensure_utc(m.created_at)
                if m_created is None:
                    continue
                if anchor_end != min_ts and m_created > anchor_end + timedelta(seconds=5):
                    continue
                if ch_created is not None and m_created < ch_created - timedelta(minutes=5):
                    continue
                eligible.append((m_created, m))

            eligible.sort(key=lambda item: item[0], reverse=True)
            for _, m in eligible[:needed]:
                m.challenge_id = ch.id
                session.add(m)
                dirty = True
                claimed_match_ids.add(m.id)
                linked_by_ch[ch.id][m.id] = m

    # 載入任何未在 challenge 本體中的額外參賽者（例如雙打現場湊咖搭檔）
    extra_uids: set[UUID] = set()
    for match_map in linked_by_ch.values():
        for m in match_map.values():
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id):
                if uid is not None and uid not in user_map:
                    extra_uids.add(uid)
    if extra_uids:
        extra_users = session.exec(select(User).where(User.id.in_(list(extra_uids)))).all()
        for u in extra_users:
            user_map[u.id] = u

    serialized_by_ch: dict[UUID, list[dict]] = {}
    for ch in with_matches:
        ordered = sorted(
            linked_by_ch[ch.id].values(),
            key=lambda m: ensure_utc(m.created_at) or min_ts,
        )
        items: list[dict] = []
        for m in ordered:
            created_utc = ensure_utc(m.created_at)
            team_a_raw = [
                _serialize_challenge_match_player(user_map, m.team_a_p1_id),
                _serialize_challenge_match_player(user_map, m.team_a_p2_id)
                if m.match_type == "doubles"
                else None,
            ]
            team_b_raw = [
                _serialize_challenge_match_player(user_map, m.team_b_p1_id),
                _serialize_challenge_match_player(user_map, m.team_b_p2_id)
                if m.match_type == "doubles"
                else None,
            ]
            items.append({
                "id": str(m.id),
                "created_at": created_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if created_utc else None,
                "status": m.status,
                "match_type": m.match_type or "singles",
                "format": m.format or "BO3",
                "score_a": m.score_a,
                "score_b": m.score_b,
                "team_a": [p for p in team_a_raw if p is not None],
                "team_b": [p for p in team_b_raw if p is not None],
                "winner_team": "A" if m.score_a > m.score_b else "B",
                "mmr_exchanged": round(m.mmr_exchanged) if m.mmr_exchanged is not None else None,
            })
        serialized_by_ch[ch.id] = items

    return serialized_by_ch, dirty


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

    matches_by_ch, backfill_dirty = _resolve_and_serialize_challenge_matches(
        session=session,
        challenges=challenges,
        user_map=user_map,
    )

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
            "reported_matches": matches_by_ch.get(ch.id, []),
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

    if backfill_dirty:
        session.commit()

    return results
