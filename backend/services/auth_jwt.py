import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from uuid import UUID

from database import get_session
from models import User

# 🔐 系統機密金鑰 (實務上這要寫在 .env 環境變數裡，絕對不能外流)
SECRET_KEY = "super-secret-precision-arena-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 識別證有效期限 (設為 7 天)

security = HTTPBearer()

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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), # 🌟 改這裡
    session: Session = Depends(get_session)) -> User:
    """
    驗證 JWT 識別證，並回傳對應的 User 物件。
    這支函式會作為 Dependency (依賴項) 放在需要保護的 API 路由上。
    """
    token = credentials.credentials # 🌟 新增這行，把真正的 token 字串抽出來
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無法驗證您的身分，請重新登入",
        headers={"WWW-Authenticate": "Bearer"},
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