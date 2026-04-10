from typing import Optional, List
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, timezone

def utc_now() -> datetime:
    """取得帶時區資訊的標準 UTC 時間"""
    return datetime.now(timezone.utc)

class User(SQLModel, table=True):
    # 1. 基本身分識別
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # ... 前面的 id, email (可以把 email 的 unique 限制拿掉，或允許 null，以防 LINE 沒提供) ...
    email: Optional[str] = Field(default=None, index=True) # 允許為空

    # 🌟 新增：第三方登入資訊
    auth_provider: str = Field(default="local", description="google 或 line")
    oauth_id: Optional[str] = Field(default=None, index=True, description="Google/LINE 提供的唯一 ID")
    
    # 2. 個人基本資料
    name: str = Field(index=True, description="同仁顯示姓名")
    department: Optional[str] = Field(default="未設定單位", description="所屬處室/單位")
    gender: Optional[str] = Field(default=None, description="性別 (例：男、女)")
    avatar_url: Optional[str] = Field(default=None, description="大頭貼網址")
    
    # 3. 🏓 戰術與裝備情報
    dominant_hand: Optional[str] = Field(default="右手", description="慣用手 (例：右手、左手)")
    rubber_forehand: Optional[str] = Field(default=None, description="正手膠皮 (例：平面-澀性膠皮)")
    rubber_backhand: Optional[str] = Field(default=None, description="反手膠皮 (例：短顆粒)")
    
    # 4. 核心實力數據
    global_mmr: float = Field(default=1000.0, description="隱藏實力分")
    
    # 5. 系統狀態與權限
    role: str = Field(default="user", description="權限：admin, user, guest")
    is_active: bool = Field(default=True, description="帳號是否活躍")

    # ==========================================
    # 🌟 關聯屬性 (Relationships) - 系統的神經網路
    # ==========================================

    # 1. 賽季紀錄：用於「排行榜」與「歷史賽季時光機」
    season_records: List["SeasonRecord"] = Relationship(back_populates="user") 

    # 2. 通知中心：用於首頁「鈴鐺紅點」與「報分審核日誌」
    notifications: List["Notification"] = Relationship(back_populates="recipient")

    # 3. 📈 戰力趨勢：用於「戰情抽屜」裡的 MMR 折線圖 (漏了這行)
    stat_history: List["PlayerStatHistory"] = Relationship(back_populates="user")

    # 4. ⚔️ 參賽足跡：連接到參與表，用於分析「黃金搭檔」與「宿命天敵」 (漏了這行)
    matches_played: List["MatchParticipation"] = Relationship(back_populates="user")

# ==========================================
# 2. Season 表 (賽季主檔)
# ==========================================
class Season(SQLModel, table=True):
    # 1. 賽季基本資訊
    id: str = Field(primary_key=True, description="賽季代號 (例：S4, 2026-Spring)")
    name: str = Field(description="賽季顯示名稱 (例：2026 春季例行賽)")
    
    # 2. 狀態與時間軸
    status: str = Field(default="active", description="狀態：active(進行中), completed(已結算)")
    start_date: datetime = Field(default_factory=utc_now, description="賽季開始時間")
    end_date: Optional[datetime] = Field(default=None, description="賽季結束時間")

    # 🔗 關聯：一個賽季包含多筆玩家的季賽紀錄
    records: List["SeasonRecord"] = Relationship(back_populates="season")

    # 🌟 讓賽季知道它擁有哪些比賽
    # 加上這個後，你可以寫 season.matches 拿到這季所有的對戰紀錄列表
    matches: List["Match"] = Relationship(back_populates="season")

# ==========================================
# 3. SeasonRecord 表 (玩家賽季戰績 - 橋樑表)
# ==========================================
class SeasonRecord(SQLModel, table=True):
    # 1. 紀錄唯一碼
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    # 2. 🔗 核心外鍵 (連結玩家與賽季)
    user_id: UUID = Field(foreign_key="user.id", index=True, description="關聯的玩家 ID")
    season_id: str = Field(foreign_key="season.id", index=True, description="關聯的賽季 ID")
    
    # 3. 📈 賽季專屬數據 (每季重置的數字都存這)
    matches_played: int = Field(default=0, description="本季出賽總數")
    wins: int = Field(default=0, description="本季勝場數")
    
    # 4. 🔼 動能指示器專用 (您加碼的神級功能)
    previous_rank: Optional[int] = Field(default=None, description="上期排名 (用於計算綠色▲/紅色▼)")

    # 🔗 雙向關聯宣告 (讓 FastAPI 知道怎麼把資料拉出來)
    user: "User" = Relationship(back_populates="season_records") 
    season: Season = Relationship(back_populates="records")


# ==========================================
# 4. Match 表 (對戰紀錄)
# ==========================================
class Match(SQLModel, table=True):
    # 1. 基本資訊
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    match_type: str = Field(default="singles")  # singles 或 doubles
    format: str = Field(default="BO3")          # BO3 或 BO5
    
    # 2. 🔗 參賽選手連結 (外鍵 ID)
    team_a_p1_id: UUID = Field(foreign_key="user.id")
    team_a_p2_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    team_b_p1_id: UUID = Field(foreign_key="user.id")
    team_b_p2_id: Optional[UUID] = Field(default=None, foreign_key="user.id")
    
    # 3. 比分結果
    score_a: int = Field(default=0)
    score_b: int = Field(default=0)
    
    # 4. ⚔️ 積分結算 (這場比賽的總變動，作為參考)
    mmr_exchanged: float = Field(default=0.0)
    
    # 5. 狀態控管
    status: str = Field(default="pending", index=True)
    reported_by: UUID = Field(foreign_key="user.id")
    
    # 6. 時間與關聯 ID
    season_id: str = Field(foreign_key="season.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)

    # ==========================================
    # 🌟 導航捷徑 (Relationships)
    # ==========================================
    
    # 賽季導航
    season: "Season" = Relationship(back_populates="matches")

    # 玩家導航 (使用 sa_relationship_kwargs 明確指定外鍵對應)
    # 這樣寫能確保 match.player1_info 拿到的絕對是 team_a_p1_id 對應的人
    player1_info: "User" = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Match.team_a_p1_id == User.id"}
    )
    player2_info: Optional["User"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Match.team_a_p2_id == User.id"}
    )
    opponent1_info: "User" = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Match.team_b_p1_id == User.id"}
    )
    opponent2_info: Optional["User"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Match.team_b_p2_id == User.id"}
    )

    # 細粒度參與者導航 (連接到我們上一題建立的 MatchParticipation)
    # 這可以讓您一秒計算「誰跟誰搭檔過」
    participants: List["MatchParticipation"] = Relationship(back_populates="match")

# ==========================================
# 5. PlayerStatHistory 表 (數據快照 - 效能優化)
# ==========================================
class PlayerStatHistory(SQLModel, table=True):
    # 1. 基本資訊
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    # 2. 🔗 連結玩家 (建立索引以加速查詢)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    
    # 3. 📸 紀錄當下的數值
    mmr: float = Field(description="紀錄當下的隱藏實力分")
    
    # 4. 📅 紀錄時間 (建立索引，方便依時間區間撈取資料)
    recorded_at: datetime = Field(default_factory=utc_now, index=True)

    # 🔗 建立與 User 的關係
    user: "User" = Relationship(back_populates="stat_history")

# ==========================================
# 6. MatchParticipation 表 (細粒度參與紀錄)
# ==========================================
class MatchParticipation(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    # 1. 🔗 核心關聯
    match_id: UUID = Field(foreign_key="match.id", index=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    
    # 2. ⚔️ 陣營與結果
    team: str = Field(description="隊伍標籤：'A' 或 'B'")
    is_winner: bool = Field(description="該玩家是否為勝方")
    
    # 3. 📈 個體分數變動 (這場比賽對「該玩家」的影響)
    mmr_delta: float = Field(default=0.0)

    # 🔗 雙向關聯宣告
    match: "Match" = Relationship(back_populates="participants")
    user: "User" = Relationship(back_populates="matches_played")

# ==========================================
# 7. Notification 表 (通知與動作紀錄)
# ==========================================
class Notification(SQLModel, table=True):
    # 1. 基本資訊
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    # 2. 🔗 核心關聯
    # user_id 是「接收這條通知的人」
    user_id: UUID = Field(foreign_key="user.id", index=True)
    # match_id 關聯到具體的比賽，點擊通知時可直接跳轉
    match_id: Optional[UUID] = Field(default=None, foreign_key="match.id")
    
    # 3. 📝 通知內文與類別
    # 類別建議：'pending_confirm'(有人報分等您確認), 'match_confirmed'(比分已生效), 'match_rejected'(比分被駁回)
    type: str = Field(index=True, description="通知類型")
    content: str = Field(description="訊息內容，例如：'林專員已報分 2:1 獲勝，請您確認'")
    
    # 4. 🔴 狀態控管 (紅點邏輯關鍵)
    is_read: bool = Field(default=False, index=True)
    
    # 5. ⏳ 時間戳記
    created_at: datetime = Field(default_factory=utc_now)

    # 🔗 建立與 User 和 Match 的關係
    recipient: "User" = Relationship(back_populates="notifications")
    match: Optional["Match"] = Relationship()

# ==========================================
# 8. SystemConfig 表 (全站系統設定)
# ==========================================
class SystemConfig(SQLModel, table=True):
    key: str = Field(primary_key=True, description="設定鍵值，例如: 'season_paused'")
    value: str = Field(description="字串值，前端或後端需自行轉換(如布林轉字串)")
    description: Optional[str] = Field(default=None, description="設定說明")
    updated_at: datetime = Field(default_factory=utc_now)

# ==========================================
# 9. Announcement 表 (全站公告)
# ==========================================
class Announcement(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(description="公告標題")
    content: str = Field(description="公告內容")
    type: str = Field(default="system", description="公告類型：'club', 'system', 'tournament'")
    link_url: Optional[str] = Field(default=None, description="按鈕連結URL")
    link_text: Optional[str] = Field(default=None, description="按鈕文字")
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utc_now)

# ==========================================
# 10. SeasonPrize 表 (賽季獎勵)
# ==========================================
class SeasonPrize(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    season_id: str = Field(foreign_key="season.id", index=True, description="關聯的賽季 ID")
    rank: int = Field(description="名次(1, 2, 3)")
    label: Optional[str] = Field(default=None, description="獎項名稱標籤 (如：MVP, 參加獎)")
    item_name: str = Field(description="獎品名稱")
    quantity: int = Field(default=1, description="獎品數量")
    image_url: Optional[str] = Field(default=None, description="圖片URL")
    
    season: Season = Relationship()

# ==========================================
# 11. TournamentEvent 表 (獨立錦標賽)
# ==========================================
class TournamentEvent(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(description="賽事名稱")
    image_url: Optional[str] = Field(default=None, description="錦標賽封面圖")
    start_date: Optional[datetime] = Field(default=None)
    end_date: Optional[datetime] = Field(default=None)
    rules: Optional[str] = Field(default=None, description="賽事規則描述 或 Challonge 連結")
    status: str = Field(default="registering", description="registering, ongoing, completed")
    created_at: datetime = Field(default_factory=utc_now)

    # 參與者
    participants: List["TournamentParticipant"] = Relationship(back_populates="tournament")

# ==========================================
# 12. TournamentParticipant 表 (錦標賽參賽者)
# ==========================================
class TournamentParticipant(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tournament_id: UUID = Field(foreign_key="tournamentevent.id", index=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    joined_at: datetime = Field(default_factory=utc_now)

    tournament: TournamentEvent = Relationship(back_populates="participants")
    user: User = Relationship()