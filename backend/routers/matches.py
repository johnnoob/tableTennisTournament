from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, or_
from uuid import UUID
import datetime

from database import get_session
from models import Match, Season, Notification, User, PlayerStatHistory, MatchParticipation, SeasonRecord
from schemas import MatchCreateReq

# 🌟 匯入我們的 Elo 引擎
from services.elo_engine import get_team_mmr, calculate_elo_delta

from services.auth_jwt import get_current_user # 🌟 匯入警衛

router = APIRouter(tags=["Matches"])

@router.post("/api/matches", summary="發起報分 (進入 Pending 狀態)")
#current_user: User = Depends(get_current_user) # 🌟 警衛站崗！
def report_match(req: MatchCreateReq, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):

    # 系統會自動檢查 Token。如果有錯，直接報 401 錯誤，程式根本不會走到這裡。
    # 走到這裡代表驗證成功，您甚至不需要前端傳 reported_by 了！
    # 直接用 current_user.id 就知道是誰報的分：
    real_reporter_id = current_user.id

    # 1. 🔍 尋找當前進行中的賽季
    statement = select(Season).where(Season.status == "active")
    current_season = session.exec(statement).first()
    
    if not current_season:
        raise HTTPException(status_code=400, detail="目前沒有進行中的賽季，無法報分！")

    # 2. 📝 建立對戰紀錄 (狀態預設為 pending)
    new_match = Match(
        match_type=req.match_type,
        format=req.format,
        team_a_p1_id=req.team_a_p1_id,
        team_a_p2_id=req.team_a_p2_id,
        team_b_p1_id=req.team_b_p1_id,
        team_b_p2_id=req.team_b_p2_id,
        score_a=req.score_a,
        score_b=req.score_b,
        reported_by=req.reported_by,
        season_id=current_season.id,
        status="pending" # 關鍵：此時還沒計算 Elo！
    )
    session.add(new_match)
    session.flush() # 將 Match 推入資料庫以取得自動生成的 ID，但先不 commit

    # 3. 🔔 建立通知發送給對手 (Team B 的玩家 1)
    # 為了在通知中顯示名字，我們去查一下報分者的名字
    reporter = session.get(User, req.reported_by)
    reporter_name = reporter.name if reporter else "某位同仁"

    notification = Notification(
        user_id=req.team_b_p1_id, # 通知接收者是對手
        match_id=new_match.id,
        type="pending_confirm",
        content=f"{reporter_name} 剛剛送出了一筆 {req.score_a}:{req.score_b} 的比分，請您確認。",
        is_read=False
    )
    session.add(notification)

    # 如果是雙打，也要通知對手的隊友
    if req.team_b_p2_id:
        notification_p2 = Notification(
            user_id=req.team_b_p2_id,
            match_id=new_match.id,
            type="pending_confirm",
            content=f"{reporter_name} 剛剛送出了一筆雙打比分，請您確認。",
            is_read=False
        )
        session.add(notification_p2)

    # 4. 💾 交易確認 (一次性將 Match 和 Notification 寫入資料庫)
    session.commit()
    session.refresh(new_match)

    return {
        "message": "報分已送出，等待對手確認中！",
        "match_id": new_match.id
    }

# 🌟 注意：我們把原本參數裡的 confirm_by 拔掉，改用 current_user 自動驗證身分！
@router.post("/api/matches/{match_id}/confirm", summary="確認比分並結算積分 (觸發 Elo 引擎)")
def confirm_match(match_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # 1. 🔍 尋找該場比賽
    match = session.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="找不到此比賽")
    if match.status != "pending":
        raise HTTPException(status_code=400, detail="此比賽不處於待確認狀態")

    # 2. 🛡️ 防呆機制：確保是「對手 (Team B)」才能確認
    if current_user.id not in [match.team_b_p1_id, match.team_b_p2_id]:
        raise HTTPException(status_code=403, detail="只有對手可以確認此比分！")

    # ==========================================
    # 🧠 3. 呼叫 Elo 引擎計算分數
    # ==========================================
    # 抓取雙方玩家目前的隱藏實力分 (MMR)
    team_a_p1 = session.get(User, match.team_a_p1_id)
    team_b_p1 = session.get(User, match.team_b_p1_id)
    
    # 判斷輸贏 (假設比分 A > B 就是 A 贏)
    a_won = match.score_a > match.score_b
    
    # 取得出賽數 (用來決定 K 值波動率)，這裡先簡單取 p1 的出賽數
    # 實務上可從 SeasonRecord 撈，這裡暫以 10 場作為基準測試
    winner_matches = 10 

    # 計算這場比賽的「絕對分數變動值 (Delta)」
    delta = calculate_elo_delta(
        winner_team_mmr=team_a_p1.global_mmr if a_won else team_b_p1.global_mmr,
        loser_team_mmr=team_b_p1.global_mmr if a_won else team_a_p1.global_mmr,
        winner_matches_played=winner_matches,
        score_winner=max(match.score_a, match.score_b),
        score_loser=min(match.score_a, match.score_b),
        format=match.format
    )

    # 紀錄該場比賽的基準分數
    match.mmr_exchanged = delta
    match.lp_exchanged = delta

    # ==========================================
    # 📝 4. 派發分數給玩家 (更新 User 與 SeasonRecord)
    # ==========================================
    def update_player_stats(player: User, is_winner: bool, team_name: str):
        if not player: return
        
        # A. 更新絕對實力 (MMR)
        actual_delta = delta if is_winner else -delta
        player.global_mmr += actual_delta
        session.add(player)

        # B. 更新賽季戰績 (Season LP)
        statement = select(SeasonRecord).where(
            SeasonRecord.user_id == player.id, 
            SeasonRecord.season_id == match.season_id
        )
        season_record = session.exec(statement).first()
        
        if season_record:
            season_record.season_lp += actual_delta
            season_record.matches_played += 1
            if is_winner:
                season_record.wins += 1
            session.add(season_record)
            current_lp = season_record.season_lp
        else:
            current_lp = actual_delta

        # C. 📸 拍下歷史快照 (給前端畫折線圖)
        history = PlayerStatHistory(
            user_id=player.id,
            mmr=player.global_mmr,
            season_lp=current_lp
        )
        session.add(history)

        # D. ⚔️ 寫入深度參與紀錄 (抓宿命天敵用)
        participation = MatchParticipation(
            match_id=match.id,
            user_id=player.id,
            team=team_name,
            is_winner=is_winner,
            mmr_delta=actual_delta,
            lp_delta=actual_delta
        )
        session.add(participation)

    # 執行派發分數
    update_player_stats(team_a_p1, is_winner=a_won, team_name="A")
    update_player_stats(team_b_p1, is_winner=not a_won, team_name="B")

    # 5. 變更比賽狀態
    match.status = "confirmed"
    session.add(match)

    # 6. 🔔 消除待確認通知，並回報給發起人
    pending_notifs = session.exec(select(Notification).where(
        Notification.match_id == match.id, Notification.type == "pending_confirm"
    )).all()
    for notif in pending_notifs:
        notif.is_read = True
        session.add(notif)

    # 7. 💾 全部寫入資料庫
    session.commit()

    return {
        "message": "比分已確認，積分結算完畢！",
        "delta": delta,
        "team_a_new_mmr": team_a_p1.global_mmr,
        "team_b_new_mmr": team_b_p1.global_mmr
    }

@router.get("/api/matches/pending", summary="取得我相關的待確認比賽")
def get_pending_matches(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    
    # 📝 撈出與「我」有關，且狀態為 pending 的比賽
    statement = select(Match).where(
        Match.status == "pending",
        or_(
            Match.team_a_p1_id == current_user.id,
            Match.team_a_p2_id == current_user.id,
            Match.team_b_p1_id == current_user.id,
            Match.team_b_p2_id == current_user.id
        )
    ).order_by(Match.created_at.desc())
    
    pending_matches = session.exec(statement).all()
    
    result = []
    for m in pending_matches:
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)

        # 🌟 呼叫 Elo 引擎試算這場比賽的 Delta 分數
        # 我們假設如果確認了，會得幾分
        potential_delta = calculate_elo_delta(
            winner_team_mmr=team_a_p1.global_mmr if m.score_a > m.score_b else team_b_p1.global_mmr,
            loser_team_mmr=team_b_p1.global_mmr if m.score_a > m.score_b else team_a_p1.global_mmr,
            winner_matches_played=10, # 試算基準
            score_winner=max(m.score_a, m.score_b),
            score_loser=min(m.score_a, m.score_b),
            format=m.format
        )
        
        player1_data = [{"id": str(team_a_p1.id), "name": team_a_p1.name, "avatar": team_a_p1.avatar_url}]
        opponent_data = [{"id": str(team_b_p1.id), "name": team_b_p1.name, "avatar": team_b_p1.avatar_url}]

        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = session.get(User, m.team_a_p2_id)
                if team_a_p2: player1_data.append({"id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url})
            if m.team_b_p2_id:
                team_b_p2 = session.get(User, m.team_b_p2_id)
                if team_b_p2: opponent_data.append({"id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url})

        # 計算 48 小時後的過期時間 (前端倒數計時用)
        expires_at = m.created_at + datetime.timedelta(hours=48)

        # 整理回傳資料
        # 注意：我們把 potential_delta 塞進 mmrChange
        # [Team A 變動, Team B 變動]
        a_change = potential_delta if m.score_a > m.score_b else -potential_delta
        b_change = -potential_delta if m.score_a > m.score_b else potential_delta

        result.append({
            "id": str(m.id),
            "date": m.created_at.strftime("%Y-%m-%d %H:%M"),
            "score": [m.score_a, m.score_b],
            "result": "win" if m.score_a > m.score_b else "loss",
            "status": m.status,
            "type": m.match_type if m.match_type else "singles",
            "mmrChange": [a_change, b_change], # 待確認還沒有分數變化
            "player1": player1_data,
            "opponent": opponent_data,
            "submittedBy": str(m.reported_by),
            "expiresAt": expires_at.isoformat()
        })
        
    return result

@router.get("/api/matches/recent", summary="取得最近的比賽紀錄 (Recent Feed)")
def get_recent_matches(limit: int = 5, session: Session = Depends(get_session)):
    # 📝 撈取最近的比賽 (包含已確認與待確認)，依照時間倒序排列
    statement = select(Match).order_by(Match.created_at.desc()).limit(limit)
    recent_matches = session.exec(statement).all()
    
    result = []
    for m in recent_matches:
        # 1. 抓取雙方「玩家 1」的詳細資料
        team_a_p1 = session.get(User, m.team_a_p1_id)
        team_b_p1 = session.get(User, m.team_b_p1_id)
        
        # 準備基礎陣列
        player1_data = [{
            "id": str(team_a_p1.id),
            "name": team_a_p1.name,
            "avatar": team_a_p1.avatar_url
        }]
        
        opponent_data = [{
            "id": str(team_b_p1.id),
            "name": team_b_p1.name,
            "avatar": team_b_p1.avatar_url
        }]

        # 🌟 2. 如果這場是雙打，把「玩家 2」的資料也拉出來放進陣列
        if m.match_type == "doubles":
            if m.team_a_p2_id:
                team_a_p2 = session.get(User, m.team_a_p2_id)
                if team_a_p2:
                    player1_data.append({
                        "id": str(team_a_p2.id), "name": team_a_p2.name, "avatar": team_a_p2.avatar_url
                    })
            if m.team_b_p2_id:
                team_b_p2 = session.get(User, m.team_b_p2_id)
                if team_b_p2:
                    opponent_data.append({
                        "id": str(team_b_p2.id), "name": team_b_p2.name, "avatar": team_b_p2.avatar_url
                    })

        # 3. 判斷勝負與分數變動
        is_a_win = m.score_a > m.score_b
        delta = m.mmr_exchanged if m.mmr_exchanged else 0
        mmr_change = [delta, -delta] if is_a_win else [-delta, delta]

        # 4. 回傳給前端
        result.append({
            "id": str(m.id),
            "date": m.created_at.strftime("%Y-%m-%d %H:%M"), 
            "score": [m.score_a, m.score_b],
            "result": "win" if is_a_win else "loss",
            "status": m.status,
            "type": m.match_type if m.match_type else "singles",
            "tournament": "雙打積分賽" if m.match_type == "doubles" else "單打積分賽",
            "mmrChange": mmr_change,
            "player1": player1_data,    # 👈 這裡現在可能是 1 個人，也可能是 2 個人
            "opponent": opponent_data   # 👈 這裡也是
        })
        
    return result