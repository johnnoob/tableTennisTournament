from datetime import datetime, timedelta, timezone
import json
import os
import re
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlmodel import Session, select, desc, func

from config import settings
from database import get_session
from services.auth_jwt import get_current_user
from services.elo_engine import ELO_CONFIG
from services.match_service import (
    MatchAlreadySettledError,
    MatchNotFoundError,
    admin_batch_force_settle_matches,
    admin_create_match,
    admin_edit_settled_match,
    admin_force_settle_match,
    admin_void_or_delete_match,
)
from models import (
    AdminAuditLog,
    Match,
    MatchParticipation,
    Notification,
    PlayerStatHistory,
    Season,
    SeasonPrize,
    SeasonRecord,
    SystemConfig,
    Announcement,
    TournamentEvent,
    TournamentParticipant,
    User,
)
from schemas import (
    ConfigUpdate,
    AnnouncementCreate,
    AnnouncementUpdate,
    SeasonPrizeUpdate,
    SeasonPrizeCreate,
    SeasonPrizeCopyReq,
    TournamentEventCreate,
    ParticipantAdd,
    SeasonStartReq,
    SeasonUpdateReq,
    SeasonRolloverReq,
    AdminUserUpdateReq,
    AdminMmrAdjustReq,
    AdminBatchDepartmentReq,
    AdminForceConfirmReq,
    AdminVoidMatchReq,
    AdminCreateMatchReq,
    AdminEditSettledMatchReq,
    AdminBatchForceConfirmReq,
)
from services.audit_service import ensure_audit_table, record_admin_audit
from services.season_service import (
    create_manual_season,
    ensure_utc,
    get_config_value,
    is_lock_on_expire_enabled,
    is_season_expired,
    settle_and_rollover_season,
    update_season_details,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# 依賴注入：確認是否為管理員
def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無管理員權限")
    return current_user

# ================================
# Common Utilities (Image Upload)
# ================================
_ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
_ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
}
_MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8MB


@router.post("/upload-image", dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)):
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type = (file.content_type or "").lower()

    if ext not in _ALLOWED_IMAGE_EXTENSIONS and content_type not in _ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="僅允許上傳 JPG、PNG、GIF 或 WebP 格式的圖片",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="圖片檔案不得為空")
    if len(raw_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="圖片檔案過大，單張上限為 8MB")

    cloud_name = settings.cloudinary_name or os.getenv("CLOUDINARY_NAME")
    api_key = settings.cloudinary_api_key or os.getenv("CLOUDINARY_API_KEY")
    api_secret = settings.cloudinary_api_secret or os.getenv("CLOUDINARY_API_SECRET")
    if not (cloud_name and api_key and api_secret):
        raise HTTPException(
            status_code=500,
            detail="後端尚未設定 Cloudinary 圖片服務金鑰（CLOUDINARY_NAME / API_KEY / API_SECRET）",
        )

    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
        )
        file.file.seek(0)
        result = cloudinary.uploader.upload(file.file)
        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(status_code=500, detail="Cloudinary 未回傳圖片網址")
        return {"url": secure_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上傳圖片失敗: {str(e)}")


# ================================
# System Configs & Audit Logs
# ================================
@router.get("/config", dependencies=[Depends(require_admin)])
def get_configs(session: Session = Depends(get_session)):
    return session.exec(select(SystemConfig)).all()


@router.put("/config/{key}")
def update_config(
    key: str,
    config_update: ConfigUpdate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    config = session.get(SystemConfig, key)
    old_value = config.value if config else None
    if not config:
        config = SystemConfig(key=key, value=config_update.value)
        session.add(config)
    else:
        config.value = config_update.value

    if old_value != config_update.value:
        record_admin_audit(
            session=session,
            actor=current_user,
            category="system",
            action="config.update",
            summary=f"調整系統參數「{key}」：{old_value if old_value is not None else '未設定'} → {config_update.value}",
            target_type="config",
            target_id=key,
            metadata={"key": key, "old_value": old_value, "new_value": config_update.value},
        )

    session.commit()
    session.refresh(config)
    return config


@router.get("/audit-logs", dependencies=[Depends(require_admin)])
def list_admin_audit_logs(
    category: str = "all",
    search: str = "",
    offset: int = 0,
    limit: int = 30,
    session: Session = Depends(get_session),
):
    """取得集中式管理員操作稽核紀錄（支援分類篩選、關鍵字搜尋與分頁）。"""
    ensure_audit_table()
    stmt = select(AdminAuditLog).order_by(desc(AdminAuditLog.created_at))
    if category and category != "all":
        stmt = stmt.where(AdminAuditLog.category == category)

    all_logs = session.exec(stmt).all()
    q = search.strip().lower()
    if q:
        filtered = [
            log
            for log in all_logs
            if q in (log.actor_name or "").lower()
            or q in (log.summary or "").lower()
            or q in (log.action or "").lower()
            or q in (log.target_id or "").lower()
        ]
    else:
        filtered = list(all_logs)

    total = len(filtered)
    safe_offset = max(0, offset)
    safe_limit = max(1, min(100, limit))
    sliced = filtered[safe_offset : safe_offset + safe_limit]

    serialized = []
    for log in sliced:
        meta = None
        if log.metadata_json:
            try:
                meta = json.loads(log.metadata_json)
            except Exception:
                meta = None
        created_utc = ensure_utc(log.created_at)
        serialized.append({
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_name": log.actor_name,
            "category": log.category,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "summary": log.summary,
            "metadata": meta,
            "created_at": created_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if created_utc else None,
        })

    return {
        "total": total,
        "has_more": (safe_offset + safe_limit) < total,
        "logs": serialized,
    }

# ================================
# System Tools & Vercel Cron
# ================================
@router.get("/system/cron-status", dependencies=[Depends(require_admin)])
def get_cron_status(session: Session = Depends(get_session)):
    """取得排程執行記錄、環境參數與目前待確認積壓統計。"""
    now = datetime.now(timezone.utc)
    last_run_at = get_config_value(session, "last_cron_run_at", "") or None
    summary_raw = get_config_value(session, "last_cron_summary", "")
    summary = None
    if summary_raw:
        try:
            summary = json.loads(summary_raw)
        except Exception:
            summary = None

    auto_confirm_hours = int(
        get_config_value(
            session,
            "match_auto_confirm_hours",
            str(settings.match_auto_confirm_duration),
        )
    )
    cutoff = (
        now - timedelta(minutes=settings.match_auto_confirm_duration)
        if settings.cron_test_mode
        else now - timedelta(hours=auto_confirm_hours)
    )

    pending_matches = session.exec(
        select(Match).where(Match.status == "pending")
    ).all()
    disputed_matches = session.exec(
        select(Match).where(Match.status == "disputed")
    ).all()
    overdue_count = sum(
        1 for m in pending_matches
        if ensure_utc(m.created_at) and ensure_utc(m.created_at) <= cutoff
    )

    decay_enabled = get_config_value(session, "decay_enabled", "false").lower() == "true"

    return {
        "last_run_at": last_run_at,
        "summary": summary,
        "cron_schedule": "0 20 * * *",
        "cron_schedule_label": "每日 04:00 (台灣時間)",
        "cron_test_mode": settings.cron_test_mode,
        "cron_secret_configured": bool(settings.cron_secret),
        "pending_total_count": len(pending_matches),
        "pending_overdue_count": overdue_count,
        "disputed_count": len(disputed_matches),
        "auto_confirm_hours": auto_confirm_hours,
        "decay_enabled": decay_enabled,
        "lock_on_expire": is_lock_on_expire_enabled(session),
    }


@router.post("/system/run-cron-now")
def run_cron_now(
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員手動立即執行一次例行排程（自動確認超時比賽 ＋ 可選衰退檢查）。"""
    from routers.cron import execute_cron_tasks

    payload = execute_cron_tasks(session, trigger="manual")
    record_admin_audit(
        session=session,
        actor=current_user,
        category="system",
        action="system.run_cron",
        summary=(
            f"手動執行例行排程：自動確認 {payload['auto_confirmed_count']} 場、"
            f"衰退 {payload['decay_count']} 人"
        ),
        target_type="system",
        target_id="cron",
        metadata={
            "auto_confirmed_count": payload["auto_confirmed_count"],
            "decay_count": payload["decay_count"],
        },
        commit=True,
    )
    return {
        "message": f"排程執行完畢：自動確認 {payload['auto_confirmed_count']} 場、衰退 {payload['decay_count']} 人。",
        **payload,
    }


@router.get("/system/decay-preview", dependencies=[Depends(require_admin)])
def get_decay_preview(session: Session = Depends(get_session)):
    """唯讀乾跑預覽：列出符合閒置扣分門檻的玩家與試算結果。"""
    from services.scheduler import preview_decay

    return preview_decay(session)


@router.post("/system/trigger-decay")
def trigger_decay(
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """手動執行一次全域惰性衰退扣分（忽略 decay_enabled 自動排程開關）。"""
    from services.scheduler import _apply_decay

    result = _apply_decay(get_session, force=True)
    record_admin_audit(
        session=session,
        actor=current_user,
        category="system",
        action="system.trigger_decay",
        summary=f"手動執行全域惰性衰退檢查：共扣分 {result['decayed_count']} 位玩家",
        target_type="system",
        target_id="decay",
        metadata=result,
        commit=True,
    )
    return {
        "message": f"惰性衰退檢查已手動執行完畢，共扣分 {result['decayed_count']} 位玩家。",
        **result,
    }


# ================================
# Seasons Lifecycle Management
# ================================
@router.get("/seasons", dependencies=[Depends(require_admin)])
def list_admin_seasons(session: Session = Depends(get_session)):
    """取得所有賽季詳細統計（含未結算比賽數、活躍人數、獎品數與 Top 3 預覽）。"""
    now = datetime.now(timezone.utc)
    seasons = session.exec(select(Season).order_by(desc(Season.start_date))).all()
    active_seasons = [s for s in seasons if s.status == "active"]
    completed_seasons = [s for s in seasons if s.status != "active"]
    ordered_seasons = active_seasons + completed_seasons

    users = session.exec(select(User).where(User.role != "guest")).all()
    user_map = {u.id: u for u in users}
    all_records = session.exec(select(SeasonRecord)).all()
    all_matches = session.exec(select(Match)).all()
    all_prizes = session.exec(select(SeasonPrize)).all()

    result = []
    for s in ordered_seasons:
        s_records = [r for r in all_records if r.season_id == s.id]
        record_by_user = {r.user_id: r for r in s_records}
        s_matches = [m for m in all_matches if m.season_id == s.id]
        settled_matches = [m for m in s_matches if m.status in ("confirmed", "completed")]
        pending_matches = [m for m in s_matches if m.status == "pending"]
        disputed_matches = [m for m in s_matches if m.status == "disputed"]
        prizes_count = sum(1 for p in all_prizes if p.season_id == s.id)

        participant_ids = {r.user_id for r in s_records if r.matches_played > 0}
        for m in settled_matches:
            for uid in (m.team_a_p1_id, m.team_a_p2_id, m.team_b_p1_id, m.team_b_p2_id):
                if uid is not None and uid in user_map:
                    participant_ids.add(uid)

        top_candidates = []
        for uid in participant_ids:
            u = user_map.get(uid)
            if not u:
                continue
            rec = record_by_user.get(uid)
            score = (
                rec.final_mmr
                if (s.status == "completed" and rec and rec.final_mmr is not None)
                else u.global_mmr
            )
            top_candidates.append({
                "player_id": str(u.id),
                "player_name": u.name,
                "avatar_url": u.avatar_url,
                "global_mmr": round(score),
            })

        top_candidates.sort(key=lambda x: x["global_mmr"], reverse=True)

        result.append({
            "id": s.id,
            "name": s.name,
            "status": s.status,
            "start_date": ensure_utc(s.start_date).isoformat() if s.start_date else None,
            "end_date": ensure_utc(s.end_date).isoformat() if s.end_date else None,
            "is_expired": bool(s.status == "active" and is_season_expired(s, now)),
            "participants_count": len(participant_ids),
            "total_matches": len(settled_matches),
            "pending_matches": len(pending_matches),
            "disputed_matches": len(disputed_matches),
            "prizes_count": prizes_count,
            "top3": top_candidates[:3],
        })

    return result


@router.get("/seasons/{season_id}/standings", dependencies=[Depends(require_admin)])
def get_admin_season_standings(season_id: str, session: Session = Depends(get_session)):
    """取得指定賽季完整排名清單（結合當季獎品對照，供匯出公告與發獎存查 CSV）。"""
    season = session.get(Season, season_id)
    if not season:
        raise HTTPException(status_code=404, detail="找不到指定的賽季")

    users = session.exec(select(User).where(User.role != "guest")).all()
    user_map = {u.id: u for u in users}

    records = session.exec(
        select(SeasonRecord).where(SeasonRecord.season_id == season_id)
    ).all()
    rec_map = {r.user_id: r for r in records}

    settled_matches = session.exec(
        select(Match).where(
            Match.season_id == season_id,
            Match.status.in_(["confirmed", "completed"]),
        )
    ).all()

    match_stats: dict[UUID, dict[str, int]] = {}
    for m in settled_matches:
        a_won = m.score_a > m.score_b
        for uid in (m.team_a_p1_id, m.team_a_p2_id):
            if uid and uid in user_map:
                st = match_stats.setdefault(uid, {"matches": 0, "wins": 0})
                st["matches"] += 1
                if a_won:
                    st["wins"] += 1
        for uid in (m.team_b_p1_id, m.team_b_p2_id):
            if uid and uid in user_map:
                st = match_stats.setdefault(uid, {"matches": 0, "wins": 0})
                st["matches"] += 1
                if not a_won:
                    st["wins"] += 1

    participant_ids = {r.user_id for r in records if r.matches_played > 0} | set(match_stats.keys())

    prizes = session.exec(
        select(SeasonPrize).where(SeasonPrize.season_id == season_id).order_by(SeasonPrize.rank)
    ).all()
    prizes_by_rank: dict[int, list[str]] = {}
    for p in prizes:
        if p.rank and p.rank > 0 and p.item_name:
            label_part = f"{p.label}：" if p.label else ""
            qty_part = f" x{p.quantity}" if (p.quantity or 1) > 1 else ""
            prizes_by_rank.setdefault(p.rank, []).append(f"{label_part}{p.item_name}{qty_part}")

    rows = []
    for uid in participant_ids:
        u = user_map.get(uid)
        if not u:
            continue
        rec = rec_map.get(uid)
        fallback_st = match_stats.get(uid, {"matches": 0, "wins": 0})
        matches_played = rec.matches_played if (rec and rec.matches_played > 0) else fallback_st["matches"]
        wins = rec.wins if (rec and rec.matches_played > 0) else fallback_st["wins"]
        losses = max(0, matches_played - wins)
        win_rate = round((wins / matches_played) * 100, 1) if matches_played > 0 else 0.0

        raw_mmr = (
            rec.final_mmr
            if (season.status == "completed" and rec and rec.final_mmr is not None)
            else u.global_mmr
        )
        rows.append({
            "user_id": str(u.id),
            "name": u.name,
            "department": u.department or "未設定單位",
            "mmr": round(float(raw_mmr), 1),
            "matches_played": matches_played,
            "wins": wins,
            "losses": losses,
            "win_rate": win_rate,
        })

    rows.sort(key=lambda r: (-r["mmr"], -r["wins"], r["matches_played"], r["name"] or ""))

    standings = []
    for idx, row in enumerate(rows, start=1):
        prize_items = prizes_by_rank.get(idx, [])
        standings.append({
            "rank": idx,
            **row,
            "prize_summary": " / ".join(prize_items),
        })

    return {
        "season_id": season.id,
        "season_name": season.name,
        "status": season.status,
        "total_players": len(standings),
        "standings": standings,
    }


@router.post("/seasons")
def admin_create_season(
    req: SeasonStartReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """休賽季時由管理員手動建立並開啟新賽季。"""
    try:
        season = create_manual_season(
            session=session,
            name=req.name,
            start_date=req.start_date,
            end_date=req.end_date,
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="seasons",
            action="season.create",
            summary=f"建立並啟動新賽季「{season.name}」（{season.id}）",
            target_type="season",
            target_id=season.id,
            commit=True,
        )
        return {
            "id": season.id,
            "name": season.name,
            "status": season.status,
            "start_date": ensure_utc(season.start_date).isoformat() if season.start_date else None,
            "end_date": ensure_utc(season.end_date).isoformat() if season.end_date else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/seasons/{season_id}")
def admin_update_season(
    season_id: str,
    req: SeasonUpdateReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員更新賽季名稱或起訖時間。"""
    try:
        season = update_season_details(
            session=session,
            season_id=season_id,
            name=req.name,
            start_date=req.start_date,
            end_date=req.end_date,
            clear_end_date=req.clear_end_date,
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="seasons",
            action="season.update",
            summary=f"更新賽季「{season.name}」名稱與起訖時程",
            target_type="season",
            target_id=season.id,
            commit=True,
        )
        return {
            "id": season.id,
            "name": season.name,
            "status": season.status,
            "start_date": ensure_utc(season.start_date).isoformat() if season.start_date else None,
            "end_date": ensure_utc(season.end_date).isoformat() if season.end_date else None,
        }
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/seasons/rollover")
def admin_rollover_season(
    req: SeasonRolloverReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """一鍵結算當前進行中賽季（含季末快照、可選軟重置與立即開啟新賽季）。"""
    try:
        res = settle_and_rollover_season(
            session=session,
            new_name=req.new_name,
            new_start_date=req.new_start_date,
            new_end_date=req.new_end_date,
            apply_soft_reset=req.apply_soft_reset,
            start_new_season=req.start_new_season,
        )
        next_info = res.get("new_season")
        next_label = f"並開啟新季「{next_info['name']}」" if next_info else "並進入休賽季"
        record_admin_audit(
            session=session,
            actor=current_user,
            category="seasons",
            action="season.rollover",
            summary=(
                f"完成賽季結算（{', '.join(res.get('settled_season_ids', []))}）{next_label}"
                f"{'，含 ELO 軟重置' if req.apply_soft_reset else ''}"
            ),
            target_type="season",
            target_id=(res.get("settled_season_ids") or [None])[0],
            metadata=res,
            commit=True,
        )
        return res
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# ================================
# Announcements
# ================================
@router.get("/announcements", dependencies=[Depends(require_admin)])
def get_announcements(session: Session = Depends(get_session)):
    return session.exec(select(Announcement).order_by(Announcement.created_at.desc())).all()

@router.post("/announcements", dependencies=[Depends(require_admin)])
def create_announcement(ann: AnnouncementCreate, session: Session = Depends(get_session)):
    new_ann = Announcement(**ann.model_dump())
    session.add(new_ann)
    session.commit()
    session.refresh(new_ann)
    return new_ann

@router.delete("/announcements/{id}", dependencies=[Depends(require_admin)])
def delete_announcement(id: UUID, session: Session = Depends(get_session)):
    ann = session.get(Announcement, id)
    if not ann:
        raise HTTPException(status_code=404, detail="找不到公告")
    session.delete(ann)
    session.commit()
    return {"message": "公告已刪除"}

@router.put("/announcements/{id}", dependencies=[Depends(require_admin)])
def update_announcement(id: UUID, ann_update: AnnouncementUpdate, session: Session = Depends(get_session)):
    ann = session.get(Announcement, id)
    if not ann:
        raise HTTPException(status_code=404, detail="找不到公告")
    
    update_data = ann_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ann, key, value)
    
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return ann

# ================================
# Season Prizes
# ================================
@router.get("/season-prizes/{season_id}", dependencies=[Depends(require_admin)])
def get_prizes(season_id: str, session: Session = Depends(get_session)):
    statement = select(SeasonPrize).where(SeasonPrize.season_id == season_id).order_by(SeasonPrize.rank)
    return session.exec(statement).all()

@router.post("/season-prizes")
def create_prize(
    prize: SeasonPrizeCreate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    new_prize = SeasonPrize(**prize.model_dump())
    session.add(new_prize)
    session.flush()
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="prize.create",
        summary=f"新增賽季「{new_prize.season_id}」獎項：第 {new_prize.rank} 名「{new_prize.item_name}」x{new_prize.quantity}",
        target_type="prize",
        target_id=new_prize.id,
    )
    session.commit()
    session.refresh(new_prize)
    return new_prize


@router.put("/season-prizes/{id}")
def update_prize(
    id: UUID,
    prize_update: SeasonPrizeUpdate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    prize = session.get(SeasonPrize, id)
    if not prize:
        raise HTTPException(status_code=404, detail="找不到獎項")

    update_data = prize_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prize, key, value)

    session.add(prize)
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="prize.update",
        summary=f"更新賽季「{prize.season_id}」獎項「{prize.item_name}」（名次 {prize.rank}）",
        target_type="prize",
        target_id=prize.id,
    )
    session.commit()
    session.refresh(prize)
    return prize


@router.delete("/season-prizes/{id}")
def delete_prize(
    id: UUID,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    prize = session.get(SeasonPrize, id)
    if not prize:
        raise HTTPException(status_code=404, detail="找不到獎項")
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="prize.delete",
        summary=f"刪除賽季「{prize.season_id}」獎項「{prize.item_name}」",
        target_type="prize",
        target_id=prize.id,
    )
    session.delete(prize)
    session.commit()
    return {"message": "獎項已刪除"}


@router.post("/season-prizes/copy")
def copy_season_prizes(
    req: SeasonPrizeCopyReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """從指定來源賽季複製獎品配置到目標賽季（支援僅補齊空缺或覆蓋取代）。"""
    if req.source_season_id == req.target_season_id:
        raise HTTPException(status_code=400, detail="來源賽季與目標賽季不得相同")
    if req.mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="複製模式僅支援 append 或 replace")

    src_season = session.get(Season, req.source_season_id)
    dst_season = session.get(Season, req.target_season_id)
    if not src_season or not dst_season:
        raise HTTPException(status_code=404, detail="找不到指定的來源或目標賽季")

    src_prizes = session.exec(
        select(SeasonPrize)
        .where(SeasonPrize.season_id == req.source_season_id)
        .order_by(SeasonPrize.rank)
    ).all()
    if not src_prizes:
        raise HTTPException(status_code=400, detail="來源賽季尚未設定任何獎品，無法複製")

    dst_prizes = session.exec(
        select(SeasonPrize).where(SeasonPrize.season_id == req.target_season_id)
    ).all()

    if req.mode == "replace":
        for existing in dst_prizes:
            session.delete(existing)
        session.flush()
        existing_standard_ranks: set[int] = set()
    else:
        existing_standard_ranks = {
            p.rank for p in dst_prizes if p.rank is not None and p.rank > 0
        }

    copied_count = 0
    skipped_count = 0
    for src in src_prizes:
        if req.mode == "append" and src.rank is not None and src.rank > 0 and src.rank in existing_standard_ranks:
            skipped_count += 1
            continue
        session.add(
            SeasonPrize(
                season_id=req.target_season_id,
                rank=src.rank,
                label=src.label,
                item_name=src.item_name,
                quantity=src.quantity,
                image_url=src.image_url,
            )
        )
        copied_count += 1

    if copied_count == 0:
        raise HTTPException(
            status_code=400,
            detail="目標賽季已有對應名次獎項，沒有可補齊的項目（可改選「覆蓋取代」）",
        )

    mode_label = "覆蓋取代" if req.mode == "replace" else "補齊空缺"
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="prize.copy",
        summary=f"從「{src_season.name}」複製 {copied_count} 項獎品至「{dst_season.name}」（{mode_label}）",
        target_type="season",
        target_id=dst_season.id,
        metadata={
            "source_season_id": src_season.id,
            "target_season_id": dst_season.id,
            "mode": req.mode,
            "copied_count": copied_count,
            "skipped_count": skipped_count,
        },
    )
    session.commit()
    return {
        "message": f"已從「{src_season.name}」複製 {copied_count} 項獎品至「{dst_season.name}」"
        + (f"（略過 {skipped_count} 項既有排名）" if skipped_count > 0 else ""),
        "copied_count": copied_count,
        "skipped_count": skipped_count,
    }

# ================================
# Tournaments
# ================================
@router.get("/tournaments", dependencies=[Depends(require_admin)])
def get_tournaments(session: Session = Depends(get_session)):
    return session.exec(select(TournamentEvent).order_by(TournamentEvent.created_at.desc())).all()

@router.post("/tournaments")
def create_tournament(
    evt: TournamentEventCreate,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    new_evt = TournamentEvent(**evt.model_dump())
    session.add(new_evt)
    session.flush()
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="tournament.create",
        summary=f"建立獨立錦標賽「{new_evt.title}」",
        target_type="tournament",
        target_id=new_evt.id,
    )
    session.commit()
    session.refresh(new_evt)
    return new_evt


@router.put("/tournaments/{id}/status")
def update_tournament_status(
    id: UUID,
    status: str,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    evt = session.get(TournamentEvent, id)
    if not evt:
        raise HTTPException(status_code=404, detail="找不到錦標賽")
    old_status = evt.status
    evt.status = status
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="tournament.status",
        summary=f"切換錦標賽「{evt.title}」狀態：{old_status} → {status}",
        target_type="tournament",
        target_id=evt.id,
    )
    session.commit()
    session.refresh(evt)
    return evt


@router.delete("/tournaments/{id}")
def delete_tournament(
    id: UUID,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    evt = session.get(TournamentEvent, id)
    if not evt:
        raise HTTPException(status_code=404, detail="找不到錦標賽")
    record_admin_audit(
        session=session,
        actor=current_user,
        category="seasons",
        action="tournament.delete",
        summary=f"刪除獨立錦標賽「{evt.title}」",
        target_type="tournament",
        target_id=evt.id,
    )
    parts = session.exec(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == id)
    ).all()
    for p in parts:
        session.delete(p)
    session.delete(evt)
    session.commit()
    return {"message": "錦標賽已刪除"}

@router.get("/tournaments/{id}/participants", dependencies=[Depends(require_admin)])
def get_participants(id: UUID, session: Session = Depends(get_session)):
    statement = select(TournamentParticipant).where(TournamentParticipant.tournament_id == id)
    parts = session.exec(statement).all()
    # 我們也需要給前端使用者的詳細資料
    res = []
    for p in parts:
        user = session.get(User, p.user_id)
        if user:
            res.append({"participant": p, "user": user})
    return res

@router.post("/tournaments/{id}/participants", dependencies=[Depends(require_admin)])
def add_participant(id: UUID, participant: ParticipantAdd, session: Session = Depends(get_session)):
    # 檢查是否已加入
    statement = select(TournamentParticipant).where(TournamentParticipant.tournament_id == id, TournamentParticipant.user_id == participant.user_id)
    existing = session.exec(statement).first()
    if existing:
        raise HTTPException(status_code=400, detail="該同仁已在參賽名單中")
    
    new_part = TournamentParticipant(tournament_id=id, user_id=participant.user_id)
    session.add(new_part)

    evt = session.get(TournamentEvent, id)
    session.add(
        Notification(
            user_id=participant.user_id,
            match_id=None,
            type="match_confirmed",
            content=f"您已被列入獨立錦標賽「{evt.title if evt else '最新賽事'}」參賽名單，可前往賽事中心查看詳情。",
        )
    )

    session.commit()
    session.refresh(new_part)
    return new_part

@router.delete("/tournaments/{id}/participants/{user_id}", dependencies=[Depends(require_admin)])
def remove_participant(id: UUID, user_id: UUID, session: Session = Depends(get_session)):
    statement = select(TournamentParticipant).where(TournamentParticipant.tournament_id == id, TournamentParticipant.user_id == user_id)
    part = session.exec(statement).first()
    if not part:
        raise HTTPException(status_code=404, detail="該同仁不在參賽名單中")
    session.delete(part)
    session.commit()
    return {"message": "已移除參賽者"}


# ================================
# Phase 3: Members, Permissions & MMR Calibration
# ================================
@router.get("/users", dependencies=[Depends(require_admin)])
def list_admin_users(session: Session = Depends(get_session)):
    """取得所有非訪客成員名單、權限角色與生涯戰績統計。"""
    users = session.exec(select(User).where(User.role != "guest")).all()
    parts = session.exec(select(MatchParticipation)).all()

    stats_map: dict[UUID, dict[str, int]] = {}
    for part in parts:
        entry = stats_map.setdefault(part.user_id, {"matches": 0, "wins": 0})
        entry["matches"] += 1
        if part.is_winner:
            entry["wins"] += 1

    result = []
    for u in users:
        st = stats_map.get(u.id, {"matches": 0, "wins": 0})
        matches_played = st["matches"]
        wins = st["wins"]
        is_env_admin = bool(u.email and u.email.lower() in settings.admin_emails_set)
        result.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "department": u.department,
            "avatar_url": u.avatar_url,
            "global_mmr": round(float(u.global_mmr), 1),
            "role": u.role,
            "is_active": u.is_active,
            "auth_provider": u.auth_provider,
            "matches_played": matches_played,
            "wins": wins,
            "losses": max(0, matches_played - wins),
            "is_env_admin": is_env_admin,
        })

    result.sort(
        key=lambda item: (
            0 if item["is_active"] else 1,
            0 if item["role"] == "admin" else 1,
            -item["global_mmr"],
            item["name"] or "",
        )
    )
    return result


@router.patch("/users/batch-department")
def batch_update_admin_user_department(
    req: AdminBatchDepartmentReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員多選批次調整多位成員的所屬單位（處室／部門）。"""
    clean_dept = req.department.strip()
    if not clean_dept:
        raise HTTPException(status_code=400, detail="單位名稱不得為空")

    unique_ids = list(dict.fromkeys(req.user_ids))
    sorted_ids = sorted(unique_ids)
    targets = session.exec(
        select(User)
        .where(User.id.in_(sorted_ids), User.role != "guest")
        .order_by(User.id)
        .with_for_update()
    ).all()

    if not targets:
        raise HTTPException(status_code=404, detail="找不到符合條件的成員資料")

    updated_names: list[str] = []
    for target in targets:
        target.department = clean_dept
        session.add(target)
        updated_names.append(target.name)

    preview_names = "、".join(updated_names[:5])
    if len(updated_names) > 5:
        preview_names += f" 等共 {len(updated_names)} 人"

    record_admin_audit(
        session=session,
        actor=current_user,
        category="members",
        action="user.batch_department",
        summary=f"批次將 {len(targets)} 位成員單位設定為「{clean_dept}」（{preview_names}）",
        target_type="user",
        metadata={
            "department": clean_dept,
            "updated_count": len(targets),
            "user_names": updated_names,
        },
    )
    session.commit()

    return {
        "message": f"已將 {len(targets)} 位成員的所屬單位調整為「{clean_dept}」",
        "updated_count": len(targets),
        "department": clean_dept,
    }


@router.get("/users/{user_id}/mmr-logs", dependencies=[Depends(require_admin)])
def get_admin_user_mmr_logs(
    user_id: UUID,
    include_matches: bool = False,
    session: Session = Depends(get_session),
):
    """取得指定成員的 ELO 異動完整日誌（含管理員手動校準原因／操作者與惰性衰退記錄）。"""
    target = session.get(User, user_id)
    if not target or target.role == "guest":
        raise HTTPException(status_code=404, detail="找不到指定的成員資料")

    ensure_audit_table()
    histories = session.exec(
        select(PlayerStatHistory)
        .where(PlayerStatHistory.user_id == user_id)
        .order_by(PlayerStatHistory.recorded_at.asc())
    ).all()

    audit_logs = session.exec(
        select(AdminAuditLog)
        .where(
            AdminAuditLog.target_id == str(user_id),
            AdminAuditLog.action == "mmr.adjust",
        )
        .order_by(AdminAuditLog.created_at.asc())
    ).all()

    notifs = session.exec(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.asc())
    ).all()

    parsed_audits = []
    for a in audit_logs:
        meta = {}
        if a.metadata_json:
            try:
                meta = json.loads(a.metadata_json)
            except Exception:
                meta = {}
        parsed_audits.append((a, ensure_utc(a.created_at), meta))

    parsed_notifs = [(n, ensure_utc(n.created_at)) for n in notifs]
    used_audit_ids: set[UUID] = set()
    used_notif_ids: set[UUID] = set()

    timeline = []
    prev_mmr: float | None = None
    for h in histories:
        h_utc = ensure_utc(h.recorded_at)
        curr_mmr = round(float(h.mmr), 1)
        old_mmr = round(prev_mmr, 1) if prev_mmr is not None else None
        delta = round(curr_mmr - prev_mmr, 1) if prev_mmr is not None else None
        prev_mmr = float(h.mmr)

        actor_name: str | None = None
        reason: str | None = None

        if h.event_type == "admin_adjust":
            best_audit = None
            best_diff = 999.0
            for a, a_utc, meta in parsed_audits:
                if a.id in used_audit_ids or not h_utc or not a_utc:
                    continue
                diff = abs((h_utc - a_utc).total_seconds())
                if diff <= 15.0 and diff < best_diff:
                    best_diff = diff
                    best_audit = (a, meta)
            if best_audit:
                a_obj, meta = best_audit
                used_audit_ids.add(a_obj.id)
                actor_name = a_obj.actor_name
                reason = meta.get("reason") or a_obj.summary
            else:
                for n_obj, n_utc in parsed_notifs:
                    if n_obj.id in used_notif_ids or not h_utc or not n_utc:
                        continue
                    if "校準" in (n_obj.content or "") and abs((h_utc - n_utc).total_seconds()) <= 15.0:
                        used_notif_ids.add(n_obj.id)
                        admin_m = re.search(r"管理員\s+([^\s]+)\s+已將", n_obj.content or "")
                        actor_name = admin_m.group(1) if admin_m else "系統管理員"
                        reason_m = _DISPUTE_REASON_RE.search(n_obj.content or "")
                        reason = reason_m.group(1) if reason_m else n_obj.content
                        break
        elif h.event_type == "decay":
            actor_name = "系統排程（惰性衰退）"
            for n_obj, n_utc in parsed_notifs:
                if n_obj.id in used_notif_ids or not h_utc or not n_utc:
                    continue
                if "未出賽" in (n_obj.content or "") and abs((h_utc - n_utc).total_seconds()) <= 15.0:
                    used_notif_ids.add(n_obj.id)
                    reason = n_obj.content
                    break
            if not reason:
                reason = "超過未出賽天數門檻自動衰退扣分"
        elif h.event_type == "soft_reset":
            actor_name = "賽季結算（軟重置）"
            reason = "季末積分軟重置：(原 ELO + 1000) ÷ 2"
        elif h.event_type == "match":
            actor_name = "賽事結算"
            reason = f"場次 #{str(h.match_id)[:4]}" if h.match_id else "對戰積分結算"

        timeline.append({
            "id": str(h.id),
            "event_type": h.event_type,
            "old_mmr": old_mmr,
            "new_mmr": curr_mmr,
            "delta": delta,
            "actor_name": actor_name,
            "reason": reason,
            "match_id": str(h.match_id) if h.match_id else None,
            "recorded_at": h_utc.strftime("%Y-%m-%dT%H:%M:%SZ") if h_utc else None,
        })

    timeline.reverse()
    filtered = timeline if include_matches else [x for x in timeline if x["event_type"] != "match"]

    return {
        "user": {
            "id": str(target.id),
            "name": target.name,
            "department": target.department,
            "avatar_url": target.avatar_url,
            "global_mmr": round(float(target.global_mmr), 1),
        },
        "total_count": len(filtered),
        "logs": filtered,
    }


@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: UUID,
    req: AdminUserUpdateReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員更新成員資料、權限角色或帳號啟用狀態（含自我與末位管理員保護）。"""
    target = session.exec(
        select(User).where(User.id == user_id).with_for_update()
    ).one_or_none()
    if not target or target.role == "guest":
        raise HTTPException(status_code=404, detail="找不到指定的成員資料")

    active_admin_count = session.exec(
        select(func.count(User.id)).where(
            User.role == "admin",
            User.is_active == True,
        )
    ).one()

    is_env_admin = bool(target.email and target.email.lower() in settings.admin_emails_set)
    old_role = target.role
    old_active = target.is_active
    old_name = target.name
    old_dept = target.department
    changes: list[str] = []

    if req.role is not None:
        if req.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="無效的權限角色，僅支援 admin 或 user")
        if target.id == current_user.id and req.role != "admin":
            raise HTTPException(status_code=400, detail="無法降級自己目前登入的管理員帳號")
        if is_env_admin and req.role != "admin":
            raise HTTPException(
                status_code=400,
                detail="此帳號受環境變數 ADMIN_EMAILS 保護，請先從環境變數移除該信箱後再降級",
            )
        if (
            target.role == "admin"
            and req.role != "admin"
            and target.is_active
            and active_admin_count <= 1
        ):
            raise HTTPException(status_code=400, detail="系統至少需保留一位啟用中的管理員")
        if req.role != old_role:
            changes.append(f"角色 {old_role} → {req.role}")
        target.role = req.role

    if req.is_active is not None:
        if target.id == current_user.id and not req.is_active:
            raise HTTPException(status_code=400, detail="無法停用自己目前登入中的帳號")
        if (
            target.role == "admin"
            and target.is_active
            and not req.is_active
            and active_admin_count <= 1
        ):
            raise HTTPException(status_code=400, detail="無法停用系統中最後一位啟用中的管理員")
        if req.is_active != old_active:
            changes.append("啟用帳號" if req.is_active else "停用帳號")
        target.is_active = req.is_active

    if req.name is not None:
        clean_name = req.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="成員顯示姓名不得為空")
        if clean_name != old_name:
            changes.append(f"姓名 {old_name} → {clean_name}")
        target.name = clean_name

    if req.department is not None:
        clean_dept = req.department.strip()
        next_dept = clean_dept or "未設定單位"
        if next_dept != old_dept:
            changes.append(f"單位 {old_dept or '未設定'} → {next_dept}")
        target.department = next_dept

    session.add(target)

    if req.role is not None and req.role != old_role and target.is_active:
        role_zh = "系統管理員" if target.role == "admin" else "一般同仁"
        session.add(
            Notification(
                user_id=target.id,
                match_id=None,
                type="match_confirmed",
                content=f"管理員 {current_user.name} 已將您的系統角色調整為「{role_zh}」。",
            )
        )

    if changes:
        record_admin_audit(
            session=session,
            actor=current_user,
            category="members",
            action="user.update",
            summary=f"更新成員「{target.name}」設定：{', '.join(changes)}",
            target_type="user",
            target_id=target.id,
            metadata={"changes": changes},
        )

    session.commit()
    session.refresh(target)

    return {
        "message": f"已更新成員「{target.name}」資料與權限設定",
        "id": str(target.id),
        "name": target.name,
        "department": target.department,
        "role": target.role,
        "is_active": target.is_active,
    }


@router.post("/users/{user_id}/adjust-mmr")
def adjust_admin_user_mmr(
    user_id: UUID,
    req: AdminMmrAdjustReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員手動校準成員 ELO 積分，並寫入歷史軌跡與透明通知。"""
    clean_reason = req.reason.strip()
    if not clean_reason:
        raise HTTPException(status_code=400, detail="請填寫積分校準原因")

    if req.target_mmr is None and req.delta is None:
        raise HTTPException(status_code=400, detail="請提供目標積分 (target_mmr) 或調整幅度 (delta)")

    target = session.exec(
        select(User).where(User.id == user_id).with_for_update()
    ).one_or_none()
    if not target or target.role == "guest":
        raise HTTPException(status_code=404, detail="找不到指定的成員資料")

    mmr_floor = float(ELO_CONFIG.get("MIN_MMR_FLOOR", 600.0))
    mmr_cap = 3000.0
    old_mmr = float(target.global_mmr)

    if req.target_mmr is not None:
        raw_new = float(req.target_mmr)
    else:
        raw_new = old_mmr + float(req.delta or 0.0)

    new_mmr = round(max(mmr_floor, min(mmr_cap, raw_new)), 1)
    actual_delta = round(new_mmr - old_mmr, 1)

    if abs(actual_delta) < 0.05:
        raise HTTPException(status_code=400, detail="調整後的積分與目前分數相同，無需異動")

    now = datetime.now(timezone.utc)
    target.global_mmr = new_mmr
    session.add(target)

    session.add(
        PlayerStatHistory(
            user_id=target.id,
            mmr=new_mmr,
            recorded_at=now,
            match_id=None,
            event_type="admin_adjust",
        )
    )

    delta_str = f"{actual_delta:+.1f}"
    notif_type = "match_confirmed" if actual_delta > 0 else "match_rejected"
    session.add(
        Notification(
            user_id=target.id,
            match_id=None,
            type=notif_type,
            content=(
                f"管理員 {current_user.name} 已將您的 ELO 積分校準為 {new_mmr:.0f}"
                f"（原 {old_mmr:.0f}，變動 {delta_str}，原因：{clean_reason}）。"
            ),
            created_at=now,
        )
    )

    record_admin_audit(
        session=session,
        actor=current_user,
        category="members",
        action="mmr.adjust",
        summary=f"校準成員「{target.name}」積分：{old_mmr:.1f} → {new_mmr:.1f}（{delta_str}，原因：{clean_reason}）",
        target_type="user",
        target_id=target.id,
        metadata={
            "old_mmr": round(old_mmr, 1),
            "new_mmr": new_mmr,
            "delta": actual_delta,
            "reason": clean_reason,
        },
    )

    session.commit()
    return {
        "message": f"已將「{target.name}」積分校準為 {new_mmr:.1f}（{delta_str}）",
        "user_id": str(target.id),
        "old_mmr": round(old_mmr, 1),
        "new_mmr": new_mmr,
        "delta": actual_delta,
    }


# ================================
# Phase 4: Match Arbitration & Rollback
# ================================
_DISPUTE_REASON_RE = re.compile(r"（原因：([^）]+)）")


@router.get("/matches", dependencies=[Depends(require_admin)])
def list_admin_matches(
    status_filter: str = "attention",
    season_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 30,
    session: Session = Depends(get_session),
):
    """取得全站對戰監控清單，支援爭議申訴、待確認、已超時、賽季篩選與分頁載入。"""
    now = datetime.now(timezone.utc)
    auto_confirm_hours = int(
        get_config_value(
            session,
            "match_auto_confirm_hours",
            str(settings.match_auto_confirm_duration),
        )
    )
    cutoff = (
        now - timedelta(minutes=settings.match_auto_confirm_duration)
        if settings.cron_test_mode
        else now - timedelta(hours=auto_confirm_hours)
    )

    all_seasons = session.exec(select(Season).order_by(desc(Season.start_date))).all()
    ordered_seasons = [s for s in all_seasons if s.status == "active"] + [
        s for s in all_seasons if s.status != "active"
    ]
    season_map = {s.id: s for s in ordered_seasons}
    seasons_payload = [
        {"id": s.id, "name": s.name, "status": s.status}
        for s in ordered_seasons
    ]

    match_stmt = select(Match).order_by(Match.created_at.desc())
    if season_id and season_id != "all":
        match_stmt = match_stmt.where(Match.season_id == season_id)
    all_matches = session.exec(match_stmt).all()

    disputed_count = 0
    pending_count = 0
    overdue_count = 0
    confirmed_count = 0

    for m in all_matches:
        if m.status == "disputed":
            disputed_count += 1
        elif m.status == "pending":
            pending_count += 1
            created_utc = ensure_utc(m.created_at)
            if created_utc and created_utc <= cutoff:
                overdue_count += 1
        elif m.status in ("confirmed", "completed"):
            confirmed_count += 1

    if status_filter == "disputed":
        filtered = [m for m in all_matches if m.status == "disputed"]
    elif status_filter == "pending":
        filtered = [m for m in all_matches if m.status == "pending"]
    elif status_filter == "confirmed":
        filtered = [m for m in all_matches if m.status in ("confirmed", "completed")]
    elif status_filter == "all":
        filtered = list(all_matches)
    else:
        # attention (default): 申訴中優先 -> 已超時待確認 -> 一般待確認
        filtered = [m for m in all_matches if m.status in ("disputed", "pending")]
        min_dt = datetime.min.replace(tzinfo=timezone.utc)

        def _attention_sort_key(match: Match):
            created_utc = ensure_utc(match.created_at) or min_dt
            is_overdue = match.status == "pending" and created_utc <= cutoff
            return (
                0 if match.status == "disputed" else 1,
                0 if is_overdue else 1,
                -created_utc.timestamp(),
            )

        filtered.sort(key=_attention_sort_key)

    safe_offset = max(0, offset)
    safe_limit = max(1, min(100, limit))
    filtered_total = len(filtered)
    sliced = filtered[safe_offset : safe_offset + safe_limit]
    has_more = (safe_offset + safe_limit) < filtered_total

    user_ids: set[UUID] = set()
    match_ids: list[UUID] = []
    for m in sliced:
        match_ids.append(m.id)
        for uid in (
            m.team_a_p1_id,
            m.team_a_p2_id,
            m.team_b_p1_id,
            m.team_b_p2_id,
            m.reported_by,
        ):
            if uid is not None:
                user_ids.add(uid)

    user_map: dict[UUID, User] = {}
    if user_ids:
        users = session.exec(select(User).where(User.id.in_(list(user_ids)))).all()
        user_map = {u.id: u for u in users}

    part_delta_map: dict[tuple[UUID, UUID], float] = {}
    if match_ids:
        parts = session.exec(
            select(MatchParticipation).where(MatchParticipation.match_id.in_(match_ids))
        ).all()
        for part in parts:
            part_delta_map[(part.match_id, part.user_id)] = float(part.mmr_delta or 0.0)

    dispute_reason_map: dict[UUID, str] = {}
    disputed_slice_ids = [m.id for m in sliced if m.status == "disputed"]
    if disputed_slice_ids:
        dispute_notifs = session.exec(
            select(Notification)
            .where(
                Notification.match_id.in_(disputed_slice_ids),
                Notification.type == "match_disputed",
            )
            .order_by(Notification.created_at.desc())
        ).all()
        for notif in dispute_notifs:
            if notif.match_id and notif.match_id not in dispute_reason_map:
                matched = _DISPUTE_REASON_RE.search(notif.content or "")
                dispute_reason_map[notif.match_id] = (
                    matched.group(1) if matched else notif.content
                )

    def _serialize_match_player(uid: UUID, match: Match, fallback_delta: float | None) -> dict:
        u = user_map.get(uid)
        delta_val = part_delta_map.get((match.id, uid))
        if delta_val is None and match.status in ("confirmed", "completed"):
            delta_val = fallback_delta
        return {
            "id": str(uid),
            "name": u.name if u else "未知選手",
            "avatar_url": u.avatar_url if u else None,
            "department": u.department if u else None,
            "mmr_delta": round(delta_val, 1) if delta_val is not None else None,
        }

    serialized = []
    for m in sliced:
        created_utc = ensure_utc(m.created_at)
        is_overdue = bool(m.status == "pending" and created_utc and created_utc <= cutoff)
        a_won = m.score_a > m.score_b
        raw_exchanged = float(m.mmr_exchanged or 0.0)
        fallback_a = (raw_exchanged if a_won else -raw_exchanged) if raw_exchanged else None
        fallback_b = (-raw_exchanged if a_won else raw_exchanged) if raw_exchanged else None

        team_a = [_serialize_match_player(m.team_a_p1_id, m, fallback_a)]
        if m.team_a_p2_id:
            team_a.append(_serialize_match_player(m.team_a_p2_id, m, fallback_a))

        team_b = [_serialize_match_player(m.team_b_p1_id, m, fallback_b)]
        if m.team_b_p2_id:
            team_b.append(_serialize_match_player(m.team_b_p2_id, m, fallback_b))

        reporter = user_map.get(m.reported_by)
        season_obj = season_map.get(m.season_id)

        serialized.append({
            "id": str(m.id),
            "match_type": m.match_type or "singles",
            "format": m.format or "BO3",
            "status": m.status,
            "score_a": m.score_a,
            "score_b": m.score_b,
            "mmr_exchanged": round(raw_exchanged, 1),
            "season_id": m.season_id,
            "season_name": season_obj.name if season_obj else m.season_id,
            "created_at": created_utc.isoformat() if created_utc else None,
            "reported_by_id": str(m.reported_by),
            "reported_by_name": reporter.name if reporter else "未知選手",
            "is_overdue": is_overdue,
            "dispute_reason": dispute_reason_map.get(m.id),
            "team_a": team_a,
            "team_b": team_b,
        })

    return {
        "counts": {
            "disputed": disputed_count,
            "pending": pending_count,
            "overdue": overdue_count,
            "confirmed": confirmed_count,
            "total": len(all_matches),
        },
        "filtered_total": filtered_total,
        "has_more": has_more,
        "auto_confirm_hours": auto_confirm_hours,
        "seasons": seasons_payload,
        "matches": serialized,
    }


@router.post("/matches")
def create_admin_match(
    req: AdminCreateMatchReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員代為補登對戰（可選立即結算積分或送出待確認）。"""
    try:
        res = admin_create_match(
            session=session,
            admin_user=current_user,
            season_id=req.season_id,
            match_type=req.match_type,
            team_a_p1_id=req.team_a_p1_id,
            team_a_p2_id=req.team_a_p2_id,
            team_b_p1_id=req.team_b_p1_id,
            team_b_p2_id=req.team_b_p2_id,
            score_a=req.score_a,
            score_b=req.score_b,
            auto_settle=req.auto_settle,
            reason=req.reason,
        )
        msg = (
            f"已代為補登賽果（{res['score_a']}:{res['score_b']}）並完成積分結算"
            if req.auto_settle
            else f"已代為補登對戰（{res['score_a']}:{res['score_b']}），等待 B 隊確認"
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="matches",
            action="match.create",
            summary=(
                f"代為補登{('雙打' if req.match_type == 'doubles' else '單打')}賽果 #{res['match_id'][:4]}"
                f"（{res['score_a']}:{res['score_b']}，{'立即結算' if req.auto_settle else '待確認'}）"
                + (f"｜備註：{req.reason.strip()}" if req.reason and req.reason.strip() else "")
            ),
            target_type="match",
            target_id=res["match_id"],
            commit=True,
        )
        return {"message": msg, **res}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/matches/batch-force-confirm")
def batch_force_confirm_admin_matches(
    req: AdminBatchForceConfirmReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員批次強制結算多筆選取比賽或一鍵結算所有已超時待確認比賽。"""
    try:
        res = admin_batch_force_settle_matches(
            session=session,
            admin_user=current_user,
            match_ids=req.match_ids,
            overdue_only=req.overdue_only,
            season_id=req.season_id,
            reason=req.reason,
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="matches",
            action="match.batch_confirm",
            summary=(
                f"{'一鍵結算超時對戰' if req.overdue_only else '批次強制裁決結算'}共 {res['confirmed_count']} 場"
                + (f"｜備註：{req.reason.strip()}" if req.reason and req.reason.strip() else "")
            ),
            target_type="match",
            metadata={"confirmed_count": res["confirmed_count"], "overdue_only": req.overdue_only},
            commit=True,
        )
        return {
            "message": f"已批次裁決並結算 {res['confirmed_count']} 場對戰！",
            **res,
        }
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到部分選取的對戰紀錄")
    except MatchAlreadySettledError:
        raise HTTPException(status_code=400, detail="部分選取的對戰已完成結算或狀態已異動")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/matches/{match_id}/score")
def edit_settled_admin_match(
    match_id: UUID,
    req: AdminEditSettledMatchReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員原地修正已結算對戰比分並原子重算本場積分與歷程快照。"""
    try:
        res = admin_edit_settled_match(
            session=session,
            match_id=match_id,
            admin_user=current_user,
            score_a=req.score_a,
            score_b=req.score_b,
            reason=req.reason,
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="matches",
            action="match.edit_score",
            summary=(
                f"更正已結算對戰 #{str(match_id)[:4]} 比分：{res['old_score']} → {res['score_a']}:{res['score_b']}"
                + (f"｜備註：{req.reason.strip()}" if req.reason and req.reason.strip() else "")
            ),
            target_type="match",
            target_id=match_id,
            commit=True,
        )
        return {
            "message": f"已將賽果更正為 {res['score_a']}:{res['score_b']} 並完成積分重算！",
            **res,
        }
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到指定的對戰紀錄")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/matches/{match_id}/force-confirm")
def force_confirm_admin_match(
    match_id: UUID,
    req: AdminForceConfirmReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員強制裁決確認對戰（可選修正比分）並立即執行 ELO 結算。"""
    try:
        res = admin_force_settle_match(
            session=session,
            match_id=match_id,
            admin_user=current_user,
            score_a=req.score_a,
            score_b=req.score_b,
            reason=req.reason,
        )
        record_admin_audit(
            session=session,
            actor=current_user,
            category="matches",
            action="match.force_confirm",
            summary=(
                f"強制裁決確認對戰 #{str(match_id)[:4]}（比分 {res['score_a']}:{res['score_b']}）"
                + (f"｜備註：{req.reason.strip()}" if req.reason and req.reason.strip() else "")
            ),
            target_type="match",
            target_id=match_id,
            commit=True,
        )
        return {
            "message": f"已完成裁決並結算對戰（{res['score_a']}:{res['score_b']}）",
            **res,
        }
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到指定的對戰紀錄")
    except MatchAlreadySettledError:
        raise HTTPException(status_code=400, detail="此對戰已完成結算，無法重複確認")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/matches/{match_id}/void")
def void_admin_match(
    match_id: UUID,
    req: AdminVoidMatchReq,
    current_user: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """管理員駁回刪除待確認比賽，或撤銷已結算比賽並原子回滾雙方 ELO 與戰績。"""
    try:
        res = admin_void_or_delete_match(
            session=session,
            match_id=match_id,
            admin_user=current_user,
            reason=req.reason,
        )
        action_zh = "撤銷並回滾已結算對戰" if res["mode"] == "rolled_back_confirmed" else "駁回並移除待審對戰"
        record_admin_audit(
            session=session,
            actor=current_user,
            category="matches",
            action="match.void",
            summary=(
                f"{action_zh} #{str(match_id)[:4]}（原比分 {res['score_label']}）"
                + (f"｜原因：{req.reason.strip()}" if req.reason and req.reason.strip() else "")
            ),
            target_type="match",
            target_id=match_id,
            commit=True,
        )
        if res["mode"] == "rolled_back_confirmed":
            msg = (
                f"已撤銷對戰（{res['score_label']}）"
                f"並原子回滾 {res['rolled_back_users']} 位選手 ELO 與戰績"
            )
        else:
            msg = f"已駁回並移除對戰報分（{res['score_label']}）"
        return {"message": msg, **res}
    except MatchNotFoundError:
        raise HTTPException(status_code=404, detail="找不到指定的對戰紀錄")