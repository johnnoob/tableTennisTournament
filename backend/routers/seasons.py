from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc, func
from database import get_session
from models import Season, SeasonPrize, SeasonRecord

router = APIRouter(tags=["Seasons"])

@router.get("/api/seasons", summary="取得所有賽季清單")
def get_all_seasons(session: Session = Depends(get_session)):
    seasons = session.exec(select(Season).order_by(desc(Season.start_date))).all()
    
    # 強制將正在進行中 (active) 的賽季提到第一順位
    active_seasons = [s for s in seasons if s.status == 'active']
    completed_seasons = [s for s in seasons if s.status != 'active']
    sorted_seasons = active_seasons + completed_seasons
    
    result = []
    for s in sorted_seasons:
        participants_count = session.exec(
            select(func.count(SeasonRecord.id))
            .where(SeasonRecord.season_id == s.id)
            .where(SeasonRecord.matches_played > 0)
        ).one()
        
        result.append({
            "id": s.id, 
            "name": s.name, 
            "status": s.status, 
            "start_date": s.start_date, 
            "end_date": s.end_date,
            "participants_count": participants_count
        })
        
    return result

@router.get("/api/seasons/{season_id}", summary="取得特定賽季詳情(含獎品)")
def get_season_detail(season_id: str, session: Session = Depends(get_session)):
    season = session.get(Season, season_id)
    if not season:
        raise HTTPException(status_code=404, detail="找不到該賽季")
    
    prizes = session.exec(select(SeasonPrize).where(SeasonPrize.season_id == season_id).order_by(SeasonPrize.rank)).all()
    
    return {
        "id": season.id,
        "name": season.name,
        "status": season.status,
        "start_date": season.start_date,
        "end_date": season.end_date,
        "prizes": prizes
    }