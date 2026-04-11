from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
import cloudinary
import cloudinary.uploader
import os
from sqlmodel import Session, select
from typing import List
from uuid import UUID

from database import get_session
from services.auth_jwt import get_current_user
from models import User, SystemConfig, Announcement, SeasonPrize, TournamentEvent, TournamentParticipant
from schemas import ConfigUpdate, AnnouncementCreate, AnnouncementUpdate, SeasonPrizeUpdate, SeasonPrizeCreate, TournamentEventCreate, ParticipantAdd

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True # 強制使用 HTTPS
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
# System Tools
# ================================
@router.post("/system/trigger-decay", dependencies=[Depends(require_admin)])
def trigger_decay(session: Session = Depends(get_session)):
    """
    手動觸發一次全域惰性衰退檢查 (Inactivity Decay Check)。
    這會調用 scheduler 中的 _apply_decay 邏輯。
    """
    from services.scheduler import _apply_decay
    from database import get_session
    
    # 注意：這裡直接傳入 get_session 函數，因為 _apply_decay 內部會處理 generator
    _apply_decay(get_session)
    
    return {"message": "惰性衰退檢查已手動觸發執行完畢。"}

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