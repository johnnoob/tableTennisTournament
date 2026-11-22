import jwt
from datetime import datetime, timedelta
from urllib.parse import urlparse
from fastapi import Depends, HTTPException, status, Cookie
from sqlmodel import Session
from uuid import UUID

from config import settings
from database import get_session
from models import User

SECRET_KEY = settings.jwt_secret_key
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days
IMPERSONATOR_TOKEN_EXPIRE_HOURS = 12
IMPERSONATOR_COOKIE_NAME = "impersonator_token"


def resolve_cookie_samesite() -> str:
    if not settings.is_production:
        return "lax"
    frontend_host = urlparse(settings.effective_frontend_url).hostname
    backend_host = urlparse(settings.effective_backend_url).hostname
    if frontend_host and backend_host and frontend_host == backend_host:
        return "lax"
    return "none"


COOKIE_SAMESITE = resolve_cookie_samesite()
COOKIE_SECURE = settings.is_production

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


def create_impersonator_token(admin_id: UUID, target_user_id: UUID) -> str:
    """發行短期管理員模擬測試憑證，用於安全切回原管理員帳號"""
    expire = datetime.utcnow() + timedelta(hours=IMPERSONATOR_TOKEN_EXPIRE_HOURS)
    to_encode = {
        "sub": str(admin_id),
        "target": str(target_user_id),
        "exp": expire,
        "type": "impersonator",
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def resolve_impersonator_admin(
    impersonator_token: str | None,
    expected_target_id: UUID | None,
    session: Session,
) -> User | None:
    """驗證模擬憑證並回傳原管理員 User；無效或非管理員則回傳 None。"""
    if not impersonator_token:
        return None
    try:
        payload = jwt.decode(impersonator_token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None

    if payload.get("type") != "impersonator":
        return None
    if expected_target_id is not None and payload.get("target") != str(expected_target_id):
        return None

    admin_id_str = payload.get("sub")
    if not admin_id_str:
        return None
    try:
        admin = session.get(User, UUID(str(admin_id_str)))
    except ValueError:
        return None

    if admin is None or not admin.is_active or admin.role != "admin":
        return None
    return admin

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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此帳號已被管理員停用，如有疑問請聯繫社團管理員",
        )

    if user.email and user.email.lower() in settings.admin_emails_set and user.role != "admin":
        user.role = "admin"
        session.add(user)
        session.commit()
        session.refresh(user)

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