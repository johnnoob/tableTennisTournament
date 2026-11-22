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


class MatchBatchConfirmReq(BaseModel):
    """前端批次確認多筆待確認賽果"""
    match_ids: list[UUID] = Field(..., min_length=1, max_length=50)

class SeasonCreate(BaseModel):
    """管理員創建賽季時傳遞的資料結構"""
    id: str  # 強制符合 YYYY-QX
    name: str 
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SeasonStartReq(BaseModel):
    """管理員手動開啟新賽季"""
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SeasonUpdateReq(BaseModel):
    """管理員編輯賽季名稱與起訖時間"""
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    clear_end_date: bool = False


class SeasonRolloverReq(BaseModel):
    """管理員一鍵結算當前賽季並（可選）開啟新賽季"""
    new_name: Optional[str] = None
    new_start_date: Optional[datetime] = None
    new_end_date: Optional[datetime] = None
    apply_soft_reset: bool = True
    start_new_season: bool = True

class ConfigUpdate(BaseModel):
    value: str

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    type: str = "system" # club, system, tournament
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: bool = True

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: Optional[bool] = None

class SeasonPrizeCreate(BaseModel):
    season_id: str
    rank: int
    label: Optional[str] = None
    item_name: str
    quantity: int = 1
    image_url: Optional[str] = None

class SeasonPrizeUpdate(BaseModel):
    rank: Optional[int] = None
    label: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    image_url: Optional[str] = None

class TournamentEventCreate(BaseModel):
    title: str
    image_url: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    rules: Optional[str] = None
    status: str = "registering"

class ParticipantAdd(BaseModel):
    user_id: UUID


class MatchPresetCreate(BaseModel):
    match_type: str = Field(default="singles", description="singles 或 doubles")
    label: Optional[str] = None
    partner_id: Optional[UUID] = None
    opponent1_id: Optional[UUID] = None
    opponent2_id: Optional[UUID] = None


class MatchPresetUpdate(BaseModel):
    match_type: Optional[str] = None
    label: Optional[str] = None
    partner_id: Optional[UUID] = None
    opponent1_id: Optional[UUID] = None
    opponent2_id: Optional[UUID] = None
    sort_order: Optional[int] = None