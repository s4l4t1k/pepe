"""
JWT authentication routes for web app users.
Supports OTP (email code) auth and legacy password auth.
"""
import logging
import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
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
    update_web_user_profile,
    set_otp,
    get_otp_user,
    clear_otp,
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
