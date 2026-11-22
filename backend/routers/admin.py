from datetime import datetime, timedelta, timezone
import json
import os
import re
from typing import List
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
    admin_force_settle_match,
    admin_void_or_delete_match,
)
from models import (
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
    TournamentEventCreate,
    ParticipantAdd,
    SeasonStartReq,
    SeasonUpdateReq,
    SeasonRolloverReq,
    AdminUserUpdateReq,
    AdminMmrAdjustReq,
    AdminForceConfirmReq,
    AdminVoidMatchReq,
)
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
@router.post("/upload-image", dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)):
    # 限制格式: JPG, PNG, GIF
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ["jpg", "jpeg", "png", "gif"]:
        raise HTTPException(status_code=400, detail="僅允許升傳 JPG, PNG, 或 GIF 格式的圖片")
    
    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.cloudinary_name or os.getenv("CLOUDINARY_NAME"),
            api_key=settings.cloudinary_api_key or os.getenv("CLOUDINARY_API_KEY"),
            api_secret=settings.cloudinary_api_secret or os.getenv("CLOUDINARY_API_SECRET"),
            secure=True,  # 強制使用 HTTPS
        )
        result = cloudinary.uploader.upload(file.file)
        return {"url": result.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上傳圖片失敗: {str(e)}")


# ================================
# System Configs
# ================================
@router.get("/config", dependencies=[Depends(require_admin)])
def get_configs(session: Session = Depends(get_session)):
    return session.exec(select(SystemConfig)).all()

@router.put("/config/{key}", dependencies=[Depends(require_admin)])
def update_config(key: str, config_update: ConfigUpdate, session: Session = Depends(get_session)):
    config = session.get(SystemConfig, key)
    if not config:
        config = SystemConfig(key=key, value=config_update.value)
        session.add(config)
    else:
        config.value = config_update.value
    session.commit()
    session.refresh(config)
    return config

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


@router.post("/system/run-cron-now", dependencies=[Depends(require_admin)])
def run_cron_now(session: Session = Depends(get_session)):
    """管理員手動立即執行一次例行排程（自動確認超時比賽 ＋ 可選衰退檢查）。"""
    from routers.cron import execute_cron_tasks

    payload = execute_cron_tasks(session, trigger="manual")
    return {
        "message": f"排程執行完畢：自動確認 {payload['auto_confirmed_count']} 場、衰退 {payload['decay_count']} 人。",
        **payload,
    }


@router.get("/system/decay-preview", dependencies=[Depends(require_admin)])
def get_decay_preview(session: Session = Depends(get_session)):
    """唯讀乾跑預覽：列出符合閒置扣分門檻的玩家與試算結果。"""
    from services.scheduler import preview_decay

    return preview_decay(session)


@router.post("/system/trigger-decay", dependencies=[Depends(require_admin)])
def trigger_decay():
    """手動執行一次全域惰性衰退扣分（忽略 decay_enabled 自動排程開關）。"""
    from services.scheduler import _apply_decay

    result = _apply_decay(get_session, force=True)
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
            "prizes_count": prizes_count,
            "top3": top_candidates[:3],
        })

    return result


@router.post("/seasons", dependencies=[Depends(require_admin)])
def admin_create_season(req: SeasonStartReq, session: Session = Depends(get_session)):
    """休賽季時由管理員手動建立並開啟新賽季。"""
    try:
        season = create_manual_season(
            session=session,
            name=req.name,
            start_date=req.start_date,
            end_date=req.end_date,
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


@router.put("/seasons/{season_id}", dependencies=[Depends(require_admin)])
def admin_update_season(season_id: str, req: SeasonUpdateReq, session: Session = Depends(get_session)):
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


@router.post("/seasons/rollover", dependencies=[Depends(require_admin)])
def admin_rollover_season(req: SeasonRolloverReq, session: Session = Depends(get_session)):
    """一鍵結算當前進行中賽季（含季末快照、可選軟重置與立即開啟新賽季）。"""
    try:
        return settle_and_rollover_season(
            session=session,
            new_name=req.new_name,
            new_start_date=req.new_start_date,
            new_end_date=req.new_end_date,
            apply_soft_reset=req.apply_soft_reset,
            start_new_season=req.start_new_season,
        )
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

@router.post("/season-prizes", dependencies=[Depends(require_admin)])
def create_prize(prize: SeasonPrizeCreate, session: Session = Depends(get_session)):
    new_prize = SeasonPrize(**prize.model_dump())
    session.add(new_prize)
    session.commit()
    session.refresh(new_prize)
    return new_prize

@router.put("/season-prizes/{id}", dependencies=[Depends(require_admin)])
def update_prize(id: UUID, prize_update: SeasonPrizeUpdate, session: Session = Depends(get_session)):
    prize = session.get(SeasonPrize, id)
    if not prize:
        raise HTTPException(status_code=404, detail="找不到獎項")
    
    update_data = prize_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prize, key, value)
    
    session.add(prize)
    session.commit()
    session.refresh(prize)
    return prize

@router.delete("/season-prizes/{id}", dependencies=[Depends(require_admin)])
def delete_prize(id: UUID, session: Session = Depends(get_session)):
    prize = session.get(SeasonPrize, id)
    if not prize:
        raise HTTPException(status_code=404, detail="找不到獎項")
    session.delete(prize)
    session.commit()
    return {"message": "獎項已刪除"}

# ================================
# Tournaments
# ================================
@router.get("/tournaments", dependencies=[Depends(require_admin)])
def get_tournaments(session: Session = Depends(get_session)):
    return session.exec(select(TournamentEvent).order_by(TournamentEvent.created_at.desc())).all()

@router.post("/tournaments", dependencies=[Depends(require_admin)])
def create_tournament(evt: TournamentEventCreate, session: Session = Depends(get_session)):
    new_evt = TournamentEvent(**evt.model_dump())
    session.add(new_evt)
    session.commit()
    session.refresh(new_evt)
    return new_evt

@router.put("/tournaments/{id}/status", dependencies=[Depends(require_admin)])
def update_tournament_status(id: UUID, status: str, session: Session = Depends(get_session)):
    evt = session.get(TournamentEvent, id)
    if not evt:
        raise HTTPException(status_code=404, detail="找不到錦標賽")
    evt.status = status
    session.commit()
    session.refresh(evt)
    return evt

@router.delete("/tournaments/{id}", dependencies=[Depends(require_admin)])
def delete_tournament(id: UUID, session: Session = Depends(get_session)):
    evt = session.get(TournamentEvent, id)
    if not evt:
        raise HTTPException(status_code=404, detail="找不到錦標賽")
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
        target.is_active = req.is_active

    if req.name is not None:
        clean_name = req.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="成員顯示姓名不得為空")
        target.name = clean_name

    if req.department is not None:
        clean_dept = req.department.strip()
        target.department = clean_dept or "未設定單位"

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
    limit: int = 80,
    session: Session = Depends(get_session),
):
    """取得全站對戰監控清單，支援爭議申訴、待確認、已超時與已結算篩選。"""
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

    all_matches = session.exec(
        select(Match).order_by(Match.created_at.desc())
    ).all()

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

    safe_limit = max(1, min(200, limit))
    sliced = filtered[:safe_limit]

    user_ids: set[UUID] = set()
    season_ids: set[str] = set()
    match_ids: list[UUID] = []
    for m in sliced:
        match_ids.append(m.id)
        season_ids.add(m.season_id)
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

    season_map: dict[str, Season] = {}
    if season_ids:
        seasons = session.exec(select(Season).where(Season.id.in_(list(season_ids)))).all()
        season_map = {s.id: s for s in seasons}

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
        "auto_confirm_hours": auto_confirm_hours,
        "matches": serialized,
    }


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