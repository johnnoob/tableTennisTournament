import os
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, Cookie
from sqlmodel import Session
from uuid import UUID

from database import get_session
from models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-for-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1          # Access Token 縮短為 15 分鐘
REFRESH_TOKEN_EXPIRE_DAYS = 7             # Refresh Token 為 7 天

# 移除 HTTPBearer，改用 Cookie
# security = HTTPBearer()

def create_access_token(user_id: UUID) -> str:
    """發行 JWT 數位識別證"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # 識別證裡面包夾的資料 (Payload)
    to_encode = {
        "sub": str(user_id), # 主旨 (Subject) 通常放 User ID
        "exp": expire        # 到期時間
    }
    
    # 使用 SECRET_KEY 簽名防偽造
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(user_id: UUID) -> str:
    """發行長效型 Refresh Token (7 天)"""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh"  # 標記為 refresh 類型以供驗證區分
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    auth_token: str = Cookie(None), # 🌟 直接從 Cookie 讀取 auth_token
    session: Session = Depends(get_session)
) -> User:
    """
    驗證 HttpOnly Cookie 中的 JWT 識別證，並回傳對應的 User 物件。
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="請先登入系統",
        )
    
    token = auth_token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="身分驗證失敗，請重新登入",
    )
    
    try:
        # 1. 解密 Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登入已過期，請重新登入")
    except jwt.PyJWTError:
        raise credentials_exception

    # 2. 去資料庫找這個人
    user = session.get(User, UUID(user_id_str))
    if user is None:
        raise credentials_exception
        
    return user

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    驗證當前登入的使用者是否具有管理員 (admin) 權限。
    如果不是管理員，直接阻擋請求並回傳 403 Forbidden。
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足：此操作需要管理員 (Admin) 權限",
        )
    return current_user