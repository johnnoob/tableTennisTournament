# backend/schemas.py
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class MatchCreateReq(BaseModel):
    """前端報分時傳送的資料結構"""
    match_type: str = Field(default="singles", description="singles 或 doubles")
    format: str = Field(default="BO3", description="BO3 或 BO5")
    
    # 玩家陣容
    team_a_p1_id: UUID
    team_a_p2_id: Optional[UUID] = None
    team_b_p1_id: UUID
    team_b_p2_id: Optional[UUID] = None
    
    # 賽果
    score_a: int
    score_b: int
    
    # 發起人 (通常未來會從 JWT Token 解析，目前開發階段先由前端傳遞)
    reported_by: UUID

class SeasonCreate(BaseModel):
    """管理員創建賽季時傳遞的資料結構"""
    id: str  # 強制符合 YYYY-QX
    name: str 
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ConfigUpdate(BaseModel):
    value: str

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: bool = True

class SeasonPrizeCreate(BaseModel):
    season_id: str
    rank: int
    item_name: str
    quantity: int = 1
    image_url: Optional[str] = None

class TournamentEventCreate(BaseModel):
    title: str
    image_url: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    rules: Optional[str] = None
    status: str = "upcoming"

class ParticipantAdd(BaseModel):
    user_id: UUID