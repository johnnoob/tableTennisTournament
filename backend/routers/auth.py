import logging
import secrets
from urllib.parse import urlencode, urlparse
from uuid import UUID

import httpx
import jwt
from authlib.integrations.base_client import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from config import settings
from database import get_session
from models import User
from services.auth_jwt import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    IMPERSONATOR_COOKIE_NAME,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    get_current_user,
    resolve_impersonator_admin,
)

router = APIRouter(tags=["Auth"])
logger = logging.getLogger(__name__)

LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"
LINE_PROFILE_URL = "https://api.line.me/v2/profile"


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


def _sanitize_next_path(next_path: str | None) -> str:
    if not next_path:
        return "/"
    raw = next_path.strip()
    if not raw or "\\" in raw:
        return "/"
    parsed = urlparse(raw)
    if parsed.scheme or parsed.netloc:
        return "/"
    path = parsed.path or "/"
    if not path.startswith("/") or path.startswith("//"):
        return "/"
    return path


def _build_frontend_redirect(path: str = "/", params: dict[str, str] | None = None) -> RedirectResponse:
    safe_path = _sanitize_next_path(path)
    url = f"{settings.effective_frontend_url}{safe_path}"
    if params:
        filtered = {k: v for k, v in params.items() if v is not None and v != ""}
        if filtered:
            url = f"{url}?{urlencode(filtered)}"
    response = RedirectResponse(url=url, status_code=302)
    response.headers["Cache-Control"] = "no-store"
    return response


def _issue_auth_cookies(response: RedirectResponse, user: User) -> RedirectResponse:
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    response.headers["Cache-Control"] = "no-store"

    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        IMPERSONATOR_COOKIE_NAME,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return response


def _resolve_origin_or_canonical_redirect(
    request: Request,
    endpoint_path: str,
    extra_query: dict[str, str] | None = None,
) -> tuple[str | None, RedirectResponse | None]:
    request_origin = _get_request_origin(request)
    target_origin = settings.effective_backend_url

    if (
        target_origin
        and "canonical" not in request.query_params
        and _normalize_origin(request_origin) != _normalize_origin(target_origin)
    ):
        query_params = {"canonical": "1"}
        if extra_query:
            query_params.update({k: v for k, v in extra_query.items() if v is not None})
        canonical_redirect = RedirectResponse(
            url=f"{target_origin}{endpoint_path}?{urlencode(query_params)}",
            status_code=302,
        )
        canonical_redirect.headers["Cache-Control"] = "no-store"
        return None, canonical_redirect

    active_origin = (
        target_origin
        if target_origin and _normalize_origin(request_origin) == _normalize_origin(target_origin)
        else request_origin
    )
    return active_origin, None


def _decode_user_id_from_cookie(token: str | None, expected_type: str | None = None) -> UUID | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if expected_type is not None and payload.get("type") != expected_type:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        return UUID(str(sub))
    except ValueError:
        return None


def _get_authenticated_user_from_cookies(request: Request, session: Session) -> User | None:
    user_id = _decode_user_id_from_cookie(request.cookies.get("auth_token"))
    if user_id is None:
        user_id = _decode_user_id_from_cookie(request.cookies.get("refresh_token"), expected_type="refresh")
    if user_id is None:
        return None
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def _has_google_linked(user: User) -> bool:
    return bool(user.google_id or (user.auth_provider == "google" and user.oauth_id))


def _has_line_linked(user: User) -> bool:
    return bool(user.line_user_id or (user.auth_provider == "line" and user.oauth_id))


def _find_user_by_google_id(session: Session, google_id: str) -> User | None:
    return session.exec(
        select(User).where(
            or_(
                User.google_id == google_id,
                and_(User.auth_provider == "google", User.oauth_id == google_id),
            )
        )
    ).first()


def _find_user_by_line_id(session: Session, line_user_id: str) -> User | None:
    return session.exec(
        select(User).where(
            or_(
                User.line_user_id == line_user_id,
                and_(User.auth_provider == "line", User.oauth_id == line_user_id),
            )
        )
    ).first()


def _find_user_by_email_ci(session: Session, email: str | None) -> User | None:
    """僅在 email 非空時進行不分大小寫比對，防止 email=None 誤配帳號。"""
    if not email or not email.strip():
        return None
    normalized = email.strip().lower()
    return session.exec(select(User).where(func.lower(User.email) == normalized)).first()


def _can_assign_email(session: Session, email: str | None, exclude_user_id: UUID | None = None) -> bool:
    if not email or not email.strip():
        return False
    existing = _find_user_by_email_ci(session, email)
    return existing is None or (exclude_user_id is not None and existing.id == exclude_user_id)


def _sync_legacy_provider_columns(user: User) -> None:
    """將舊資料的 auth_provider/oauth_id 補寫進 google_id 或 line_user_id。"""
    if user.auth_provider == "google" and user.oauth_id and not user.google_id:
        user.google_id = user.oauth_id
    elif user.auth_provider == "line" and user.oauth_id and not user.line_user_id:
        user.line_user_id = user.oauth_id


async def _exchange_line_code(code: str, redirect_uri: str, expected_nonce: str | None) -> dict[str, str | None]:
    """用授權碼向 LINE Login v2.1 換取 Token，驗證 ID Token 並取得 Profile。"""
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            LINE_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": settings.line_channel_id,
                "client_secret": settings.line_channel_secret,
            },
        )
        if token_resp.status_code != 200:
            logger.warning("LINE token exchange failed status=%s body=%s", token_resp.status_code, token_resp.text[:300])
            raise ValueError("line_token_exchange_failed")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")

        id_sub: str | None = None
        id_email: str | None = None
        id_name: str | None = None
        id_picture: str | None = None

        if id_token:
            verify_payload = {
                "id_token": id_token,
                "client_id": settings.line_channel_id,
            }
            if expected_nonce:
                verify_payload["nonce"] = expected_nonce
            verify_resp = await client.post(LINE_VERIFY_URL, data=verify_payload)
            if verify_resp.status_code != 200:
                logger.warning("LINE id_token verify failed status=%s body=%s", verify_resp.status_code, verify_resp.text[:300])
                raise ValueError("line_id_token_invalid")
            id_claims = verify_resp.json()
            id_sub = id_claims.get("sub")
            id_email = id_claims.get("email")
            id_name = id_claims.get("name")
            id_picture = id_claims.get("picture")

        profile_user_id: str | None = None
        profile_name: str | None = None
        profile_picture: str | None = None
        if access_token:
            profile_resp = await client.get(
                LINE_PROFILE_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile_resp.status_code == 200:
                profile = profile_resp.json()
                profile_user_id = profile.get("userId")
                profile_name = profile.get("displayName")
                profile_picture = profile.get("pictureUrl")

        if id_sub and profile_user_id and id_sub != profile_user_id:
            raise ValueError("line_identity_mismatch")

        line_user_id = id_sub or profile_user_id
        display_name = (profile_name or id_name or "LINE 球友").strip() or "LINE 球友"
        picture = profile_picture or id_picture
        clean_email = (id_email or "").strip().lower() or None

        return {
            "line_user_id": line_user_id,
            "display_name": display_name,
            "picture": picture,
            "email": clean_email,
        }


# 🌟 初始化 Google OAuth
oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/api/auth/providers", summary="取得系統已啟用的第三方登入方式")
def get_auth_providers():
    return {
        "google": settings.google_login_enabled,
        "line": settings.line_login_enabled,
    }


@router.get("/api/auth/google/login")
async def google_login(request: Request):
    """前端點擊 Google 登入後，導向 Google OAuth 授權頁"""
    if not settings.google_login_enabled:
        return _build_frontend_redirect("/login", {"error": "google_not_configured"})

    active_origin, canonical_redirect = _resolve_origin_or_canonical_redirect(
        request,
        "/api/auth/google/login",
    )
    if canonical_redirect is not None:
        return canonical_redirect

    request.session["google_oauth_mode"] = "login"
    request.session.pop("google_link_user_id", None)
    request.session.pop("google_return_to", None)

    redirect_uri = f"{active_origin}/api/auth/google/callback"
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/api/auth/google/link")
async def google_link(
    request: Request,
    next: str | None = None,
    session: Session = Depends(get_session),
):
    """已登入使用者從個人設定綁定 Google 帳號"""
    return_to = _sanitize_next_path(next)
    if not settings.google_login_enabled:
        return _build_frontend_redirect(return_to, {"auth_error": "google_not_configured"})

    active_origin, canonical_redirect = _resolve_origin_or_canonical_redirect(
        request,
        "/api/auth/google/link",
        extra_query={"next": return_to},
    )
    if canonical_redirect is not None:
        return canonical_redirect

    current_user = _get_authenticated_user_from_cookies(request, session)
    if current_user is None:
        return _build_frontend_redirect("/login", {"error": "session_expired"})

    request.session["google_oauth_mode"] = "link"
    request.session["google_link_user_id"] = str(current_user.id)
    request.session["google_return_to"] = return_to

    redirect_uri = f"{active_origin}/api/auth/google/callback"
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/api/auth/google/callback")
async def google_callback(request: Request, session: Session = Depends(get_session)):
    """Google 驗證成功後，處理登入或帳號綁定"""
    mode = request.session.pop("google_oauth_mode", "login")
    link_user_id = request.session.pop("google_link_user_id", None)
    return_to = _sanitize_next_path(request.session.pop("google_return_to", "/"))

    def fail_redirect(code: str) -> RedirectResponse:
        if mode == "link":
            return _build_frontend_redirect(return_to, {"auth_error": code})
        return _build_frontend_redirect("/login", {"error": code})

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
        return fail_redirect(exc.error or "oauth_failed")

    user_info = token.get("userinfo")
    google_id = user_info.get("sub") if user_info else None
    if not user_info or not google_id:
        return fail_redirect("missing_userinfo")

    raw_email = user_info.get("email")
    email = raw_email.strip().lower() if isinstance(raw_email, str) and raw_email.strip() else None
    name = (user_info.get("name") or "Google 球友").strip() or "Google 球友"
    picture = user_info.get("picture")
    is_env_admin = bool(email and email in settings.admin_emails_set)

    if mode == "link":
        try:
            target_uuid = UUID(str(link_user_id))
        except (ValueError, TypeError):
            return _build_frontend_redirect("/login", {"error": "session_expired"})

        current_user = session.get(User, target_uuid)
        if current_user is None:
            return _build_frontend_redirect("/login", {"error": "session_expired"})
        if not current_user.is_active:
            return _build_frontend_redirect("/login", {"error": "account_disabled"})

        existing = _find_user_by_google_id(session, google_id)
        if existing and existing.id != current_user.id:
            return _build_frontend_redirect(return_to, {"auth_error": "google_already_linked"})

        _sync_legacy_provider_columns(current_user)
        current_user.google_id = google_id
        if not current_user.oauth_id or current_user.auth_provider == "google":
            current_user.oauth_id = google_id
            if current_user.auth_provider == "local":
                current_user.auth_provider = "google"
        if not current_user.avatar_url and picture:
            current_user.avatar_url = picture
        if not current_user.email and _can_assign_email(session, email, current_user.id):
            current_user.email = email
        if is_env_admin and current_user.role != "admin":
            current_user.role = "admin"

        session.add(current_user)
        session.commit()
        session.refresh(current_user)

        response = _build_frontend_redirect(return_to, {"auth_notice": "google_linked"})
        return _issue_auth_cookies(response, current_user)

    # 登入模式
    user = _find_user_by_google_id(session, google_id)
    if user:
        if not user.is_active:
            return _build_frontend_redirect("/login", {"error": "account_disabled"})
        _sync_legacy_provider_columns(user)
        user.google_id = google_id
        if not user.avatar_url and picture:
            user.avatar_url = picture
        if not user.email and _can_assign_email(session, email, user.id):
            user.email = email
        if is_env_admin and user.role != "admin":
            user.role = "admin"
    else:
        user_by_email = _find_user_by_email_ci(session, email)
        if user_by_email:
            if not user_by_email.is_active:
                return _build_frontend_redirect("/login", {"error": "account_disabled"})
            _sync_legacy_provider_columns(user_by_email)
            if user_by_email.google_id and user_by_email.google_id != google_id:
                return _build_frontend_redirect("/login", {"error": "email_already_bound_other_google"})
            user = user_by_email
            user.google_id = google_id
            if user.auth_provider == "local" or not user.oauth_id:
                user.auth_provider = "google"
                user.oauth_id = google_id
            if not user.avatar_url and picture:
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
                google_id=google_id,
                department="未設定處室",
                global_mmr=1000.0,
                role="admin" if is_env_admin else "user",
            )

    session.add(user)
    session.commit()
    session.refresh(user)

    response = _build_frontend_redirect("/")
    return _issue_auth_cookies(response, user)


@router.get("/api/auth/line/login")
async def line_login(request: Request):
    """前端點擊 LINE 登入後，導向 LINE Login v2.1 授權頁"""
    if not settings.line_login_enabled:
        return _build_frontend_redirect("/login", {"error": "line_not_configured"})

    active_origin, canonical_redirect = _resolve_origin_or_canonical_redirect(
        request,
        "/api/auth/line/login",
    )
    if canonical_redirect is not None:
        return canonical_redirect

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(24)
    redirect_uri = f"{active_origin}/api/auth/line/callback"

    request.session["line_oauth_state"] = state
    request.session["line_oauth_nonce"] = nonce
    request.session["line_oauth_mode"] = "login"
    request.session["line_redirect_uri"] = redirect_uri
    request.session.pop("line_link_user_id", None)
    request.session.pop("line_return_to", None)

    auth_query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.line_channel_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "profile openid email",
            "nonce": nonce,
        }
    )
    response = RedirectResponse(url=f"{LINE_AUTHORIZE_URL}?{auth_query}", status_code=302)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/api/auth/line/link")
async def line_link(
    request: Request,
    next: str | None = None,
    session: Session = Depends(get_session),
):
    """已登入使用者從個人設定綁定 LINE 帳號"""
    return_to = _sanitize_next_path(next)
    if not settings.line_login_enabled:
        return _build_frontend_redirect(return_to, {"auth_error": "line_not_configured"})

    active_origin, canonical_redirect = _resolve_origin_or_canonical_redirect(
        request,
        "/api/auth/line/link",
        extra_query={"next": return_to},
    )
    if canonical_redirect is not None:
        return canonical_redirect

    current_user = _get_authenticated_user_from_cookies(request, session)
    if current_user is None:
        return _build_frontend_redirect("/login", {"error": "session_expired"})

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(24)
    redirect_uri = f"{active_origin}/api/auth/line/callback"

    request.session["line_oauth_state"] = state
    request.session["line_oauth_nonce"] = nonce
    request.session["line_oauth_mode"] = "link"
    request.session["line_redirect_uri"] = redirect_uri
    request.session["line_link_user_id"] = str(current_user.id)
    request.session["line_return_to"] = return_to

    auth_query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.line_channel_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "profile openid email",
            "nonce": nonce,
        }
    )
    response = RedirectResponse(url=f"{LINE_AUTHORIZE_URL}?{auth_query}", status_code=302)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/api/auth/line/callback")
async def line_callback(request: Request, session: Session = Depends(get_session)):
    """LINE 授權完成回呼：支援直接登入與雙帳號綁定"""
    expected_state = request.session.pop("line_oauth_state", None)
    expected_nonce = request.session.pop("line_oauth_nonce", None)
    mode = request.session.pop("line_oauth_mode", "login")
    stored_redirect_uri = request.session.pop("line_redirect_uri", None)
    link_user_id = request.session.pop("line_link_user_id", None)
    return_to = _sanitize_next_path(request.session.pop("line_return_to", "/"))

    def fail_redirect(code: str) -> RedirectResponse:
        if mode == "link":
            return _build_frontend_redirect(return_to, {"auth_error": code})
        return _build_frontend_redirect("/login", {"error": code})

    if not settings.line_login_enabled:
        return fail_redirect("line_not_configured")

    err = request.query_params.get("error")
    if err:
        return fail_redirect(err)

    code = request.query_params.get("code")
    returned_state = request.query_params.get("state")
    if (
        not expected_state
        or not returned_state
        or not secrets.compare_digest(str(returned_state), str(expected_state))
        or not code
    ):
        logger.warning(
            "LINE OAuth state mismatch has_expected=%s has_returned=%s has_code=%s has_session_cookie=%s",
            bool(expected_state),
            bool(returned_state),
            bool(code),
            "session" in request.cookies,
        )
        return fail_redirect("mismatching_state")

    request_origin = _get_request_origin(request)
    target_origin = settings.effective_backend_url
    active_origin = (
        target_origin
        if target_origin and _normalize_origin(request_origin) == _normalize_origin(target_origin)
        else request_origin
    )
    redirect_uri = stored_redirect_uri or f"{active_origin}/api/auth/line/callback"

    try:
        line_info = await _exchange_line_code(code, redirect_uri, expected_nonce)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("LINE OAuth callback exchange failed: %s", exc)
        return fail_redirect("oauth_failed")

    line_user_id = line_info.get("line_user_id")
    if not line_user_id:
        return fail_redirect("missing_userinfo")

    display_name = line_info.get("display_name") or "LINE 球友"
    picture = line_info.get("picture")
    email = line_info.get("email")
    is_env_admin = bool(email and email in settings.admin_emails_set)

    if mode == "link":
        try:
            target_uuid = UUID(str(link_user_id))
        except (ValueError, TypeError):
            return _build_frontend_redirect("/login", {"error": "session_expired"})

        current_user = session.get(User, target_uuid)
        if current_user is None:
            return _build_frontend_redirect("/login", {"error": "session_expired"})
        if not current_user.is_active:
            return _build_frontend_redirect("/login", {"error": "account_disabled"})

        existing = _find_user_by_line_id(session, line_user_id)
        if existing and existing.id != current_user.id:
            return _build_frontend_redirect(return_to, {"auth_error": "line_already_linked"})

        _sync_legacy_provider_columns(current_user)
        current_user.line_user_id = line_user_id
        current_user.line_display_name = display_name
        if not current_user.oauth_id or current_user.auth_provider == "line":
            current_user.oauth_id = line_user_id
            if current_user.auth_provider == "local":
                current_user.auth_provider = "line"
        if not current_user.avatar_url and picture:
            current_user.avatar_url = picture
        if not current_user.email and _can_assign_email(session, email, current_user.id):
            current_user.email = email
        if is_env_admin and current_user.role != "admin":
            current_user.role = "admin"

        session.add(current_user)
        session.commit()
        session.refresh(current_user)

        response = _build_frontend_redirect(return_to, {"auth_notice": "line_linked"})
        return _issue_auth_cookies(response, current_user)

    # 登入模式
    user = _find_user_by_line_id(session, line_user_id)
    if user:
        if not user.is_active:
            return _build_frontend_redirect("/login", {"error": "account_disabled"})
        _sync_legacy_provider_columns(user)
        user.line_user_id = line_user_id
        user.line_display_name = display_name
        if not user.avatar_url and picture:
            user.avatar_url = picture
        if not user.email and _can_assign_email(session, email, user.id):
            user.email = email
        if is_env_admin and user.role != "admin":
            user.role = "admin"
    else:
        user_by_email = _find_user_by_email_ci(session, email)
        if user_by_email:
            if not user_by_email.is_active:
                return _build_frontend_redirect("/login", {"error": "account_disabled"})
            _sync_legacy_provider_columns(user_by_email)
            if user_by_email.line_user_id and user_by_email.line_user_id != line_user_id:
                return _build_frontend_redirect("/login", {"error": "email_already_bound_other_line"})
            user = user_by_email
            user.line_user_id = line_user_id
            user.line_display_name = display_name
            if user.auth_provider == "local" or not user.oauth_id:
                user.auth_provider = "line"
                user.oauth_id = line_user_id
            if not user.avatar_url and picture:
                user.avatar_url = picture
            if is_env_admin and user.role != "admin":
                user.role = "admin"
        else:
            user = User(
                email=email,
                name=display_name,
                avatar_url=picture,
                auth_provider="line",
                oauth_id=line_user_id,
                line_user_id=line_user_id,
                line_display_name=display_name,
                department="未設定處室",
                global_mmr=1000.0,
                role="admin" if is_env_admin else "user",
            )

    session.add(user)
    session.commit()
    session.refresh(user)

    response = _build_frontend_redirect("/")
    return _issue_auth_cookies(response, user)


@router.delete("/api/auth/providers/{provider}", summary="解除單一第三方登入方式綁定")
def unlink_oauth_provider(
    provider: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    normalized = provider.strip().lower()
    if normalized not in ("google", "line"):
        raise HTTPException(status_code=400, detail="不支援的登入方式")

    _sync_legacy_provider_columns(current_user)
    has_google = _has_google_linked(current_user)
    has_line = _has_line_linked(current_user)

    if normalized == "line":
        if not has_line:
            raise HTTPException(status_code=400, detail="尚未綁定 LINE 帳號")
        if not has_google:
            raise HTTPException(
                status_code=400,
                detail="這是您唯一的登入方式，請先綁定 Google 帳號後再解除 LINE 綁定，以免無法登入",
            )
        current_user.line_user_id = None
        current_user.line_display_name = None
        if current_user.auth_provider == "line":
            current_user.auth_provider = "google"
            current_user.oauth_id = current_user.google_id
    else:
        if not has_google:
            raise HTTPException(status_code=400, detail="尚未綁定 Google 帳號")
        if not has_line:
            raise HTTPException(
                status_code=400,
                detail="這是您唯一的登入方式，請先綁定 LINE 帳號後再解除 Google 綁定，以免無法登入",
            )
        current_user.google_id = None
        if current_user.auth_provider == "google":
            current_user.auth_provider = "line"
            current_user.oauth_id = current_user.line_user_id

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return {
        "status": "ok",
        "google_linked": _has_google_linked(current_user),
        "line_linked": _has_line_linked(current_user),
        "line_display_name": current_user.line_display_name,
    }


@router.post("/api/auth/impersonation/stop", summary="結束測試身分模擬並切回原管理員帳號")
def stop_impersonation(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    token = request.cookies.get(IMPERSONATOR_COOKIE_NAME)
    admin = resolve_impersonator_admin(token, expected_target_id=None, session=session)
    if admin is None:
        response.delete_cookie(
            IMPERSONATOR_COOKIE_NAME,
            httponly=True,
            samesite=COOKIE_SAMESITE,
            secure=COOKIE_SECURE,
        )
        raise HTTPException(status_code=401, detail="找不到有效的管理員模擬憑證，請重新登入")

    new_access_token = create_access_token(admin.id)
    new_refresh_token = create_refresh_token(admin.id)

    response.set_cookie(
        key="auth_token",
        value=new_access_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        IMPERSONATOR_COOKIE_NAME,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return {
        "message": f"已切回管理員帳號「{admin.name}」",
        "admin_id": str(admin.id),
        "admin_name": admin.name,
    }


@router.post("/api/auth/logout")
async def logout(response: Response):
    """清除所有 Auth 相關的 Cookie 登出"""
    response.delete_cookie(
        "auth_token",
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        "refresh_token",
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        IMPERSONATOR_COOKIE_NAME,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return {"message": "Logged out successfully"}


@router.post("/api/auth/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
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
        payload = jwt.decode(
            refresh_token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="憑證類型錯誤")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="無效的憑證內容")

        user = session.get(User, UUID(user_id))
        if user is None:
            raise HTTPException(status_code=401, detail="使用者不存在或已被刪除，拒絕刷新")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="此帳號已被管理員停用")

        new_access_token = create_access_token(user.id)

        response.set_cookie(
            key="auth_token",
            value=new_access_token,
            httponly=True,
            samesite=COOKIE_SAMESITE,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            secure=COOKIE_SECURE,
        )
        return {"status": "success", "message": "Access token refreshed"}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh Token 已過期，請重新登入")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="憑證損毀或身分異常，請重新登入")
