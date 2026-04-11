from typing import List, Dict
from uuid import UUID
from sqlmodel import Session, select, func
from models import MatchParticipation

def get_career_match_counts(session: Session, user_ids: List[UUID]) -> Dict[UUID, int]:
    """
    批次計算一組玩家的生涯出賽總數 (Batch calculate career match counts).
    回傳字典 {user_id: count}。
    """
    if not user_ids:
        return {}
    
    # 使用 IN 查詢與 GROUP BY 避免 N+1 問題
    statement = (
        select(MatchParticipation.user_id, func.count(MatchParticipation.id))
        .where(MatchParticipation.user_id.in_(user_ids))
        .group_by(MatchParticipation.user_id)
    )
    
    results = session.exec(statement).all()
    
    # 初始化所有請求的 ID 為 0
    counts = {uid: 0 for uid in user_ids}
    for uid, count in results:
        counts[uid] = count
        
    return counts

def get_career_match_count(session: Session, user_id: UUID) -> int:
    """
    取得單一玩家的生涯出賽總數。
    """
    return get_career_match_counts(session, [user_id]).get(user_id, 0)
