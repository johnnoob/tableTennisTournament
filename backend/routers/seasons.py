from fastapi import APIRouter, Depends
from sqlmodel import Session, select, desc
from database import get_session
from models import Season

router = APIRouter(tags=["Seasons"])

@router.get("/api/seasons", summary="取得所有賽季清單")
def get_all_seasons(session: Session = Depends(get_session)):
    seasons = session.exec(select(Season).order_by(desc(Season.start_date))).all()
    return [{"id": s.id, "name": s.name, "status": s.status} for s in seasons]