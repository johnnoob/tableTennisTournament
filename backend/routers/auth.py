import os
from fastapi import APIRouter, Request, Depends, Response, HTTPException
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlmodel import Session, select
from uuid import UUID

from database import get_session
from models import User
from services.auth_jwt import create_access_token, SECRET_KEY, ALGORITHM
import jwt

router = APIRouter(tags=["Auth"])
is_production = os.getenv("ENV_STATUS", "development") == "production"

# 🌟 初始化 OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """前端點擊登入後，會先呼叫這支 API，我們再把它導向 Google"""
    # 告訴 Google 成功後要導回哪支 API
    redirect_uri = "http://localhost:8000/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/api/auth/google/callback")
async def google_callback(request: Request, session: Session = Depends(get_session)):
    """Google 驗證成功後，會帶著資料回到這裡"""
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    
    if not user_info:
        return {"error": "無法取得 Google 使用者資訊"}

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    # 🔍 1. 在資料庫尋找是否已有此使用者
    statement = select(User).where(User.oauth_id == google_id)
    user = session.exec(statement).first()

    # 📝 2. 如果是新同仁，自動幫他註冊
    if not user:
        # 如果有用同樣的 email 註冊過，就綁定在一起
        user_by_email = session.exec(select(User).where(User.email == email)).first()
        if user_by_email:
            user = user_by_email
            user.oauth_id = google_id
            user.auth_provider = "google"
            user.avatar_url = picture
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
                role="user"
            )
        session.add(user)
        session.commit()
        session.refresh(user)

    # 🔐 3. 發行我們自己的 JWT 識別證
    jwt_token = create_access_token(user.id)

    # 🚀 4. 不再將 Token 放在網址中，改用 HttpOnly Cookie
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173")
    response = RedirectResponse(url=f"{frontend_base}/")
    
    # 🔐 設定 Cookie (開發環境 secure 先設為 False)
    response.set_cookie(
        key="auth_token",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        max_age=60*60*24*7, # 7 天
        secure=is_production  # 生產環境應設為 True
    )
    return response

@router.post("/api/auth/logout")
async def logout(response: Response):
    """清除 Cookie 登出"""
    response.delete_cookie("auth_token")
    return {"message": "Logged out successfully"}

@router.post("/api/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """
    無感刷新 (Silent Refresh)：使用舊的（可能已過期）JWT 換取新 JWT。
    前提：Token 簽名必須合法且存在於 Cookie 中。
    """
    auth_token = request.cookies.get("auth_token")
    if not auth_token:
        raise HTTPException(status_code=401, detail="找不到憑證，無法刷新")

    try:
        # 🌟 略過 exp 檢查 (verify_exp=False)，但仍驗證簽名 SECRET_KEY
        payload = jwt.decode(
            auth_token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM], 
            options={"verify_exp": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="無效的憑證內容")
            
        # 簽發新 Token
        new_token = create_access_token(UUID(user_id))

        # 塞回 Cookie
        response.set_cookie(
            key="auth_token",
            value=new_token,
            httponly=True,
            samesite="lax",
            max_age=60*60*24*7, # 1 星期
            secure=is_production 
        )
        return {"status": "success", "message": "Token refreshed"}
        
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="憑證損毀或身分異常，請重新登入")