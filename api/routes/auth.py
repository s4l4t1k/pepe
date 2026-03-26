"""
JWT authentication routes for web app users.
Supports OTP (email code), Google OAuth, Telegram Login, and legacy password auth.
"""
import hashlib
import hmac
import logging
import os
import random
import string
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    get_session,
    create_web_user,
    get_web_user_by_email,
    get_web_user_by_id,
    get_web_user_by_telegram_id,
    get_web_user_by_google_id,
    update_web_user_profile,
    set_otp,
    get_otp_user,
    clear_otp,
    create_telegram_login_session,
    get_telegram_login_session,
    complete_telegram_login_session,
    delete_telegram_login_session,
)
from core.email import send_otp_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "poker-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
OTP_EXPIRE_MINUTES = 10

bearer_scheme = HTTPBearer()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SendCodeRequest(BaseModel):
    email: str

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()


class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    first_name: Optional[str] = None

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()

    @validator("code")
    def code_clean(cls, v):
        return v.strip()


class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()


class LoginRequest(BaseModel):
    email: str
    password: str

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()


class UpdateProfileRequest(BaseModel):
    experience_level: Optional[str] = None
    play_style: Optional[str] = None
    first_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    experience_level: Optional[str]
    play_style: Optional[str]
    hands_analyzed_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _user_out(user) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        experience_level=user.experience_level,
        play_style=user.play_style,
        hands_analyzed_count=user.hands_analyzed_count,
        created_at=user.created_at,
    )


async def get_current_web_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    token = credentials.credentials
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if not user_id_str:
            raise exc
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise exc

    user = await get_web_user_by_id(session, user_id)
    if not user:
        raise exc
    return user


# ── OTP Endpoints ─────────────────────────────────────────────────────────────

@router.post("/send-code")
async def send_code(
    req: SendCodeRequest,
    session: AsyncSession = Depends(get_session),
):
    """Send OTP to email. Returns is_new=True if user doesn't exist yet."""
    existing = await get_web_user_by_email(session, req.email)
    is_new = existing is None

    code = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)

    if is_new:
        # Create placeholder so we can store OTP
        await create_web_user(session, email=req.email, first_name="")

    await set_otp(session, req.email, code, expires_at)

    sent = await send_otp_email(req.email, code)
    if not sent:
        logger.warning(f"[DEV] OTP for {req.email}: {code}")

    return {"ok": True, "is_new": is_new}


@router.post("/verify-code", response_model=TokenResponse)
async def verify_code(
    req: VerifyCodeRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Verify OTP code, return JWT."""
    user = await get_otp_user(session, req.email)

    if not user or not user.otp_code:
        raise HTTPException(status_code=400, detail="Сначала запроси код")

    if datetime.utcnow() > (user.otp_expires_at or datetime.min):
        raise HTTPException(status_code=400, detail="Код истёк. Запроси новый")

    if user.otp_code != req.code:
        raise HTTPException(status_code=400, detail="Неверный код")

    if not user.first_name:
        if not req.first_name or not req.first_name.strip():
            raise HTTPException(status_code=400, detail="Введи своё имя")
        user.first_name = req.first_name.strip()

    await clear_otp(session, user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=_user_out(user))


# ── Social config ─────────────────────────────────────────────────────────────

@router.get("/social-config")
async def social_config():
    """Return which social auth methods are enabled (public)."""
    return {
        "google_enabled": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "telegram_bot_username": os.getenv("TELEGRAM_BOT_USERNAME", ""),
    }


# ── Google OAuth ───────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "")
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=503, detail="Google OAuth не настроен на сервере")
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
async def google_callback(
    code: str,
    session: AsyncSession = Depends(get_session),
):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "")

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            # Exchange code for tokens
            token_resp = await http.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "code": code,
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise ValueError("No access_token from Google")

            # Get user info
            user_resp = await http.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_info = user_resp.json()
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        return RedirectResponse("/auth?error=google_failed")

    google_id = user_info.get("sub", "")
    email = user_info.get("email", "").lower().strip()
    first_name = user_info.get("given_name") or (user_info.get("name", "").split() or [""])[0] or "User"

    if not google_id or not email:
        return RedirectResponse("/auth?error=google_no_email")

    # Find or create user
    user = await get_web_user_by_google_id(session, google_id)
    if not user:
        user = await get_web_user_by_email(session, email)
    if not user:
        user = await create_web_user(session, email=email, first_name=first_name, google_id=google_id)
    else:
        if not user.google_id:
            user.google_id = google_id
            await session.commit()
        if not user.first_name:
            user.first_name = first_name
            await session.commit()

    jwt_token = create_access_token(user.id)
    return RedirectResponse(f"/auth?token={jwt_token}")


# ── Telegram Bot OTP Login ─────────────────────────────────────────────────────

import secrets as _secrets


@router.post("/telegram/init")
async def telegram_init(session: AsyncSession = Depends(get_session)):
    """Create a Telegram login session. Returns session_token + bot_username."""
    bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "")
    if not bot_username:
        raise HTTPException(status_code=503, detail="Telegram auth не настроен на сервере")

    session_token = _secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    await create_telegram_login_session(session, session_token, expires_at)

    return {"session_token": session_token, "bot_username": bot_username}


class TelegramVerifyRequest(BaseModel):
    session_token: str
    code: str


@router.post("/telegram/verify", response_model=TokenResponse)
async def telegram_verify(
    req: TelegramVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Verify Telegram OTP code from bot, return JWT."""
    tg_session = await get_telegram_login_session(session, req.session_token)

    if not tg_session:
        raise HTTPException(status_code=400, detail="Сессия не найдена. Попробуй снова")

    if datetime.utcnow() > tg_session.expires_at:
        raise HTTPException(status_code=400, detail="Сессия истекла. Нажми «Войти через Telegram» снова")

    if not tg_session.otp_code:
        raise HTTPException(status_code=400, detail="Бот ещё не прислал код. Открой бота и нажми Старт")

    if tg_session.otp_code != req.code.strip():
        raise HTTPException(status_code=400, detail="Неверный код")

    tg_id = tg_session.telegram_id
    first_name = tg_session.telegram_first_name or "Игрок"

    # Find or create WebUser
    web_user = await get_web_user_by_telegram_id(session, tg_id)
    if not web_user:
        tg_email = f"tg_{tg_id}@telegram.user"
        web_user = await get_web_user_by_email(session, tg_email)
        if not web_user:
            web_user = await create_web_user(
                session, email=tg_email, first_name=first_name, telegram_id=tg_id
            )
        else:
            web_user.telegram_id = tg_id
            if not web_user.first_name:
                web_user.first_name = first_name
            await session.commit()

    await delete_telegram_login_session(session, req.session_token)

    token = create_access_token(web_user.id)
    return TokenResponse(access_token=token, user=_user_out(web_user))


# ── Legacy password endpoints ─────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    req: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    existing = await get_web_user_by_email(session, req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    user = await create_web_user(session, email=req.email, first_name=req.first_name,
                                  password_hash=hash_password(req.password))
    return TokenResponse(access_token=create_access_token(user.id), user=_user_out(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    user = await get_web_user_by_email(session, req.email)
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return TokenResponse(access_token=create_access_token(user.id), user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user=Depends(get_current_web_user)) -> UserOut:
    return _user_out(current_user)


@router.put("/profile", response_model=UserOut)
async def update_profile(
    req: UpdateProfileRequest,
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    valid_experience = {"beginner", "amateur", "semipro", "pro"}
    valid_styles = {"lag", "tag", "lap", "tap", "unknown"}

    if req.experience_level and req.experience_level not in valid_experience:
        raise HTTPException(status_code=400, detail="Недопустимый уровень опыта")
    if req.play_style and req.play_style not in valid_styles:
        raise HTTPException(status_code=400, detail="Недопустимый стиль игры")

    user = await update_web_user_profile(session, user_id=current_user.id,
                                          experience_level=req.experience_level,
                                          play_style=req.play_style, first_name=req.first_name)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return _user_out(user)
