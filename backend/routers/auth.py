import os
from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlmodel import Session, select
from uuid import uuid4

from database import get_session
from models import User
from services.auth_jwt import create_access_token

router = APIRouter(tags=["Auth"])

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

    # 🚀 4. 帶著 Token 重新導向回前端 (Vite) 的 Dashboard 頁面
    # 這樣前端就能從網址列拿到 Token 了！
    frontend_url = f"http://localhost:5173/?token={jwt_token}"
    return RedirectResponse(url=frontend_url)