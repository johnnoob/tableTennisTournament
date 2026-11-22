from typing import List, Dict, Iterable
from uuid import UUID
from sqlmodel import Session, select, func
from models import MatchParticipation, SeasonRecord

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


def get_season_match_counts(
    session: Session,
    season_ids: Iterable[str],
    user_ids: List[UUID],
) -> Dict[tuple[str, UUID], int]:
    """
    批次取得多組 (season_id, user_id) 的當季已出賽場數。
    回傳字典 {(season_id, user_id): matches_played}，無紀錄者預設為 0。
    """
    clean_seasons = [sid for sid in set(season_ids) if sid]
    clean_users = list(set(user_ids))
    if not clean_seasons or not clean_users:
        return {}

    records = session.exec(
        select(SeasonRecord).where(
            SeasonRecord.season_id.in_(clean_seasons),
            SeasonRecord.user_id.in_(clean_users),
        )
    ).all()

    counts: Dict[tuple[str, UUID], int] = {
        (sid, uid): 0
        for sid in clean_seasons
        for uid in clean_users
    }
    for rec in records:
        counts[(rec.season_id, rec.user_id)] = max(0, int(rec.matches_played or 0))
    return counts
