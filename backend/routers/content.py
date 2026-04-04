from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from models import Announcement, TournamentEvent, SystemConfig
from typing import List

router = APIRouter(prefix="/api", tags=["Content"])

@router.get("/announcements")
def get_public_announcements(session: Session = Depends(get_session)):
    """取得所有啟用的公告"""
    statement = select(Announcement).where(Announcement.is_active == True).order_by(Announcement.created_at.desc())
    return session.exec(statement).all()

@router.get("/tournaments")
def get_public_tournaments(session: Session = Depends(get_session)):
    """取得所有獨立錦標賽"""
    statement = select(TournamentEvent).order_by(TournamentEvent.created_at.desc())
    return session.exec(statement).all()

@router.get("/config/public")
def get_public_config(session: Session = Depends(get_session)):
    """取得非敏感的系統設定 (如是否暫停)"""
    keys = ["season_paused", "season_interval_months", "season_start_date"]
    statement = select(SystemConfig).where(SystemConfig.key.in_(keys))
    configs = session.exec(statement).all()
    return {c.key: c.value for c in configs}
