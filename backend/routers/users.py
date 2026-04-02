from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from services.auth_jwt import get_current_user # 🌟 引入警衛
from models import User

router = APIRouter(tags=["Users"])

@router.get("/api/users", summary="取得機關所有同仁名單")
def get_all_users(session: Session = Depends(get_session)):
    # 📝 從資料庫撈出所有的 User
    statement = select(User)
    users = session.exec(statement).all()
    
    # 為了版面乾淨，我們只回傳 ID、姓名和處室
    return [
        {
            "name": user.name,
            "department": user.department,
            "id": user.id,
            "mmr": user.global_mmr
        }
        for user in users
    ]

@router.get("/api/users/me", summary="獲取當前登入者的個人資料")
def get_my_profile(current_user: User = Depends(get_current_user)):
    # 只要 Token 正確，current_user 就會是資料庫裡的該名玩家物件
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "department": current_user.department,
        "avatar": current_user.avatar_url,
        "mmr": current_user.global_mmr,
        "role": current_user.role,
        "dominant_hand": current_user.dominant_hand,
        "rubber_forehand": current_user.rubber_forehand,
        "rubber_backhand": current_user.rubber_backhand,
        "gender": current_user.gender,
    }