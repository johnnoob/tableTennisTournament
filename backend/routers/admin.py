from datetime import datetime, timedelta, timezone
import json
import os
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlmodel import Session, select, desc

from config import settings
from database import get_session
from services.auth_jwt import get_current_user
from models import (
    Match,
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