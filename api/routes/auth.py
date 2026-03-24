"""
JWT authentication routes for web app users.
"""
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    get_session,
    create_web_user,
    get_web_user_by_email,
    get_web_user_by_id,
    update_web_user_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "poker-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str

    @validator("email")
    def email_lower(cls, v):
        return v.lower().strip()

    @validator("password")
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Пароль должен содержать минимум 6 символов")
        return v

    @validator("first_name")
    def first_name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Имя не может быть пустым")
        return v.strip()


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


# ── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_web_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    """Dependency: decode JWT and return WebUser."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await get_web_user_by_id(session, user_id)
    if user is None:
        raise credentials_exception
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    req: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Register a new web user."""
    existing = await get_web_user_by_email(session, req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    password_hash = hash_password(req.password)
    user = await create_web_user(
        session,
        email=req.email,
        password_hash=password_hash,
        first_name=req.first_name,
    )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            experience_level=user.experience_level,
            play_style=user.play_style,
            hands_analyzed_count=user.hands_analyzed_count,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Login with email and password."""
    user = await get_web_user_by_email(session, req.email)
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            experience_level=user.experience_level,
            play_style=user.play_style,
            hands_analyzed_count=user.hands_analyzed_count,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user=Depends(get_current_web_user),
) -> UserOut:
    """Get current authenticated user."""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        experience_level=current_user.experience_level,
        play_style=current_user.play_style,
        hands_analyzed_count=current_user.hands_analyzed_count,
        created_at=current_user.created_at,
    )


@router.put("/profile", response_model=UserOut)
async def update_profile(
    req: UpdateProfileRequest,
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    """Update user profile fields."""
    valid_experience = {"beginner", "amateur", "semipro", "pro"}
    valid_styles = {"lag", "tag", "lap", "tap", "unknown"}

    if req.experience_level and req.experience_level not in valid_experience:
        raise HTTPException(status_code=400, detail="Недопустимый уровень опыта")
    if req.play_style and req.play_style not in valid_styles:
        raise HTTPException(status_code=400, detail="Недопустимый стиль игры")

    user = await update_web_user_profile(
        session,
        user_id=current_user.id,
        experience_level=req.experience_level,
        play_style=req.play_style,
        first_name=req.first_name,
    )
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        experience_level=user.experience_level,
        play_style=user.play_style,
        hands_analyzed_count=user.hands_analyzed_count,
        created_at=user.created_at,
    )
