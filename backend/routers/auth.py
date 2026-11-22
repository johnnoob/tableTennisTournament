import logging
from urllib.parse import quote, urlparse

from fastapi import APIRouter, Request, Depends, Response, HTTPException
from fastapi.responses import RedirectResponse
from authlib.integrations.base_client import OAuthError
from authlib.integrations.starlette_client import OAuth
from sqlmodel import Session, select
from uuid import UUID

from config import settings
from database import get_session
from models import User
from services.auth_jwt import (
    create_access_token, 
    create_refresh_token, 
    SECRET_KEY, 
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
import jwt

router = APIRouter(tags=["Auth"])
logger = logging.getLogger(__name__)


def _get_request_origin(request: Request) -> str:
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    ).split(",")[0].strip()
    return f"{proto}://{host}".rstrip("/")


def _normalize_origin(origin: str) -> tuple[str, str]:
    parsed = urlparse(origin.strip().rstrip("/"))
    return (parsed.scheme.lower(), parsed.netloc.lower())


def _resolve_cookie_samesite() -> str:
    if not settings.is_production:
        return "lax"
    frontend_host = urlparse(settings.effective_frontend_url).hostname
    backend_host = urlparse(settings.effective_backend_url).hostname
    if frontend_host and backend_host and frontend_host == backend_host:
        return "lax"
    return "none"


COOKIE_SAMESITE = _resolve_cookie_samesite()
COOKIE_SECURE = settings.is_production


# 🌟 初始化 OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """前端點擊登入後，會先呼叫這支 API，我們再把它導向 Google"""
    request_origin = _get_request_origin(request)
    target_origin = settings.effective_backend_url

    if (
        target_origin
        and "canonical" not in request.query_params
        and _normalize_origin(request_origin) != _normalize_origin(target_origin)
    ):
        canonical_redirect = RedirectResponse(
            url=f"{target_origin}/api/auth/google/login?canonical=1",
            status_code=302,
        )
        canonical_redirect.headers["Cache-Control"] = "no-store"
        return canonical_redirect

    active_origin = (
        target_origin
        if target_origin and _normalize_origin(request_origin) == _normalize_origin(target_origin)
        else request_origin
    )
    redirect_uri = f"{active_origin}/api/auth/google/callback"
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    response.headers["Cache-Control"] = "no-store"
    return response

@router.get("/api/auth/google/callback")
async def google_callback(request: Request, session: Session = Depends(get_session)):
    """Google 驗證成功後，會帶著資料回到這裡"""
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as exc:
        logger.warning(
            "Google OAuth callback error=%s desc=%s origin=%s has_session_cookie=%s",
            exc.error,
            exc.description,
            _get_request_origin(request),
            "session" in request.cookies,
        )
        err_code = quote(exc.error or "oauth_failed")
        err_redirect = RedirectResponse(
            url=f"{settings.effective_frontend_url}/login?error={err_code}",
            status_code=302,
        )
        err_redirect.headers["Cache-Control"] = "no-store"
        return err_redirect

    user_info = token.get('userinfo')
    
    if not user_info:
        err_redirect = RedirectResponse(
            url=f"{settings.effective_frontend_url}/login?error=missing_userinfo",
            status_code=302,
        )
        err_redirect.headers["Cache-Control"] = "no-store"
        return err_redirect

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    # 🔍 1. 在資料庫尋找是否已有此使用者
    statement = select(User).where(User.oauth_id == google_id)
    user = session.exec(statement).first()

    # 📝 2. 如果是新同仁，自動幫他註冊
    is_env_admin = bool(email and email.lower() in settings.admin_emails_set)
    if not user:
        # 如果有用同樣的 email 註冊過，就綁定在一起
        user_by_email = session.exec(select(User).where(User.email == email)).first()
        if user_by_email:
            user = user_by_email
            user.oauth_id = google_id
            user.auth_provider = "google"
            user.avatar_url = picture
            if is_env_admin and user.role != "admin":
                user.role = "admin"
        else:
            user = User(
                email=email,
                name=name,
                avatar_url=picture,
                auth_provider="google",
                oauth_id=google_id,
                # 預設給一些基本設定
                department="未設定處室",
                global_mmr=1200.0,
                role="admin" if is_env_admin else "user"
            )
        session.add(user)
        session.commit()
        session.refresh(user)
    elif is_env_admin and user.role != "admin":
        user.role = "admin"
        session.add(user)
        session.commit()
        session.refresh(user)

    # 🔐 3. 發行 Access Token 與 Refresh Token
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # 🚀 4. 使用 HttpOnly Cookie 儲存雙 Token
    response = RedirectResponse(url=f"{settings.effective_frontend_url}/")
    response.headers["Cache-Control"] = "no-store"
    
    # 🔐 設定 Access Token Cookie (短效)
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=COOKIE_SECURE
    )

    # 🔐 設定 Refresh Token Cookie (長效)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        secure=COOKIE_SECURE
    )
    return response

@router.post("/api/auth/logout")
async def logout(response: Response):
    """清除所有 Auth 相關的 Cookie 登出"""
    response.delete_cookie(
        "auth_token",
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )
    response.delete_cookie(
        "refresh_token",
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE
    )
    return {"message": "Logged out successfully"}

@router.post("/api/auth/refresh")
async def refresh_token(
    request: Request, 
    response: Response, 
    session: Session = Depends(get_session)
):
    """
    使用 Refresh Token 換取新的 Access Token。
    1. 驗證 Refresh Token 簽名與效期。
    2. 驗證使用者是否仍存在於資料庫。
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="找不到 Refresh Token，請重新登入")

    try:
        # 🌟 驗證 Refresh Token (包含過期檢查)
        payload = jwt.decode(
            refresh_token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM]
        )
        
        # 確保 Token 類型正確
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="憑證類型錯誤")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="無效的憑證內容")
            
        # 🔍 驗證資料庫使用者狀態 (Fix Issue 1)
        # 根據用戶指示：僅檢查使用者是否存在於資料庫 (非 None)
        user = session.get(User, UUID(user_id))
        if user is None:
            raise HTTPException(status_code=401, detail="使用者不存在或已被刪除，拒絕刷新")

        # 簽發新的短效 Access Token
        new_access_token = create_access_token(user.id)

        # 塞回 Cookie (僅更新 Access Token)
        response.set_cookie(
            key="auth_token",
            value=new_access_token,
            httponly=True,
            samesite=COOKIE_SAMESITE,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            secure=COOKIE_SECURE
        )
        return {"status": "success", "message": "Access token refreshed"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh Token 已過期，請重新登入")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="憑證損毀或身分異常，請重新登入")