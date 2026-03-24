import os
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, BigInteger,
    ForeignKey, select, desc, func, text
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./poker_analyzer.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    experience_level = Column(String(50), nullable=True)
    play_style = Column(String(50), nullable=True)
    hands_analyzed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active = Column(DateTime, default=datetime.utcnow, nullable=False)

    hands = relationship("Hand", back_populates="user", lazy="select",
                         foreign_keys="Hand.user_id")
    training_progress = relationship("TrainingProgress", back_populates="user", lazy="select",
                                     foreign_keys="TrainingProgress.user_id")


class WebUser(Base):
    __tablename__ = "web_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(255), nullable=False)
    experience_level = Column(String(50), nullable=True)
    play_style = Column(String(50), nullable=True)
    hands_analyzed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    web_hands = relationship("Hand", back_populates="web_user", lazy="select",
                             foreign_keys="Hand.web_user_id")
    web_training_progress = relationship("TrainingProgress", back_populates="web_user", lazy="select",
                                         foreign_keys="TrainingProgress.web_user_id")


class Hand(Base):
    __tablename__ = "hands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    web_user_id = Column(Integer, ForeignKey("web_users.id"), nullable=True, index=True)
    hand_text = Column(Text, nullable=False)
    parsed_data = Column(Text, nullable=True)   # JSON stored as text
    analysis = Column(Text, nullable=True)       # JSON stored as text
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="hands", foreign_keys=[user_id])
    web_user = relationship("WebUser", back_populates="web_hands", foreign_keys=[web_user_id])


class TrainingProgress(Base):
    __tablename__ = "training_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    web_user_id = Column(Integer, ForeignKey("web_users.id"), nullable=True, index=True)
    lesson_id = Column(String(50), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="training_progress", foreign_keys=[user_id])
    web_user = relationship("WebUser", back_populates="web_training_progress", foreign_keys=[web_user_id])


async def init_db() -> None:
    """Create all tables and run migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: make hands.user_id nullable (fix NOT NULL constraint from old schema)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS hands_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                web_user_id INTEGER REFERENCES web_users(id),
                hand_text TEXT NOT NULL,
                parsed_data TEXT,
                analysis TEXT,
                created_at DATETIME NOT NULL
            )
        """))
        # Check if old hands table still has NOT NULL on user_id
        result = await conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='hands'"))
        row = result.fetchone()
        if row and 'user_id INTEGER NOT NULL' in (row[0] or ''):
            await conn.execute(text(
                "INSERT INTO hands_new (id, user_id, web_user_id, hand_text, parsed_data, analysis, created_at) "
                "SELECT id, user_id, web_user_id, hand_text, parsed_data, analysis, "
                "COALESCE(created_at, datetime('now')) FROM hands"
            ))
            await conn.execute(text("DROP TABLE hands"))
            await conn.execute(text("ALTER TABLE hands_new RENAME TO hands"))


async def get_session() -> AsyncSession:
    """Dependency for FastAPI."""
    async with async_session_factory() as session:
        yield session


# ── Telegram User Repository helpers ─────────────────────────────────────────

async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
) -> User:
    result = await session.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            hands_analyzed_count=0,
            last_active=datetime.utcnow(),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        user.last_active = datetime.utcnow()
        if username:
            user.username = username
        if first_name:
            user.first_name = first_name
        await session.commit()
        await session.refresh(user)
    return user


async def get_user_by_telegram_id(
    session: AsyncSession,
    telegram_id: int,
) -> Optional[User]:
    result = await session.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    return result.scalar_one_or_none()


async def update_user_profile(
    session: AsyncSession,
    telegram_id: int,
    phone: Optional[str] = None,
    experience_level: Optional[str] = None,
    play_style: Optional[str] = None,
) -> Optional[User]:
    result = await session.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if phone is not None:
        user.phone = phone
    if experience_level is not None:
        user.experience_level = experience_level
    if play_style is not None:
        user.play_style = play_style
    await session.commit()
    await session.refresh(user)
    return user


async def save_hand(
    session: AsyncSession,
    user_id: int,
    hand_text: str,
    parsed_data_json: str,
    analysis_json: str,
    web_user_id: Optional[int] = None,
) -> Hand:
    hand = Hand(
        user_id=user_id,
        web_user_id=web_user_id,
        hand_text=hand_text,
        parsed_data=parsed_data_json,
        analysis=analysis_json,
    )
    session.add(hand)

    # Increment hands_analyzed_count for telegram user
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.hands_analyzed_count = (user.hands_analyzed_count or 0) + 1

    await session.commit()
    await session.refresh(hand)
    return hand


async def get_user_hands(
    session: AsyncSession,
    user_id: int,
    limit: int = 5,
) -> List[Hand]:
    result = await session.execute(
        select(Hand)
        .where(Hand.user_id == user_id)
        .order_by(desc(Hand.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_lesson_complete(
    session: AsyncSession,
    user_id: int,
    lesson_id: str,
) -> TrainingProgress:
    # Check if already completed
    result = await session.execute(
        select(TrainingProgress).where(
            TrainingProgress.user_id == user_id,
            TrainingProgress.lesson_id == lesson_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    progress = TrainingProgress(
        user_id=user_id,
        lesson_id=lesson_id,
        completed_at=datetime.utcnow(),
    )
    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return progress


async def get_completed_lessons(
    session: AsyncSession,
    user_id: int,
) -> List[str]:
    result = await session.execute(
        select(TrainingProgress.lesson_id).where(TrainingProgress.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_user_stats(
    session: AsyncSession,
    user_id: int,
) -> dict:
    """Return aggregate stats for a user."""
    hands_result = await session.execute(
        select(func.count(Hand.id)).where(Hand.user_id == user_id)
    )
    hands_count = hands_result.scalar() or 0

    lessons_result = await session.execute(
        select(func.count(TrainingProgress.id)).where(TrainingProgress.user_id == user_id)
    )
    lessons_count = lessons_result.scalar() or 0

    return {
        "hands_count": hands_count,
        "lessons_count": lessons_count,
    }


# ── WebUser Repository helpers ────────────────────────────────────────────────

async def create_web_user(
    session: AsyncSession,
    email: str,
    password_hash: str,
    first_name: str,
) -> WebUser:
    user = WebUser(
        email=email,
        password_hash=password_hash,
        first_name=first_name,
        hands_analyzed_count=0,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_web_user_by_email(
    session: AsyncSession,
    email: str,
) -> Optional[WebUser]:
    result = await session.execute(
        select(WebUser).where(WebUser.email == email)
    )
    return result.scalar_one_or_none()


async def get_web_user_by_id(
    session: AsyncSession,
    user_id: int,
) -> Optional[WebUser]:
    result = await session.execute(
        select(WebUser).where(WebUser.id == user_id)
    )
    return result.scalar_one_or_none()


async def update_web_user_profile(
    session: AsyncSession,
    user_id: int,
    experience_level: Optional[str] = None,
    play_style: Optional[str] = None,
    first_name: Optional[str] = None,
) -> Optional[WebUser]:
    result = await session.execute(
        select(WebUser).where(WebUser.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if experience_level is not None:
        user.experience_level = experience_level
    if play_style is not None:
        user.play_style = play_style
    if first_name is not None:
        user.first_name = first_name
    await session.commit()
    await session.refresh(user)
    return user


async def get_web_user_stats(
    session: AsyncSession,
    user_id: int,
) -> dict:
    """Return aggregate stats for a web user."""
    hands_result = await session.execute(
        select(func.count(Hand.id)).where(Hand.web_user_id == user_id)
    )
    hands_count = hands_result.scalar() or 0

    lessons_result = await session.execute(
        select(func.count(TrainingProgress.id)).where(TrainingProgress.web_user_id == user_id)
    )
    lessons_count = lessons_result.scalar() or 0

    return {
        "hands_count": hands_count,
        "lessons_count": lessons_count,
    }


async def save_web_hand(
    session: AsyncSession,
    web_user_id: int,
    hand_text: str,
    parsed_data_json: str,
    analysis_json: str,
) -> Hand:
    hand = Hand(
        web_user_id=web_user_id,
        hand_text=hand_text,
        parsed_data=parsed_data_json,
        analysis=analysis_json,
    )
    session.add(hand)

    # Increment hands_analyzed_count for web user
    result = await session.execute(select(WebUser).where(WebUser.id == web_user_id))
    user = result.scalar_one_or_none()
    if user:
        user.hands_analyzed_count = (user.hands_analyzed_count or 0) + 1

    await session.commit()
    await session.refresh(hand)
    return hand


async def get_web_user_hands(
    session: AsyncSession,
    web_user_id: int,
    limit: int = 20,
) -> List[Hand]:
    result = await session.execute(
        select(Hand)
        .where(Hand.web_user_id == web_user_id)
        .order_by(desc(Hand.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_web_completed_lessons(
    session: AsyncSession,
    web_user_id: int,
) -> List[str]:
    result = await session.execute(
        select(TrainingProgress.lesson_id).where(TrainingProgress.web_user_id == web_user_id)
    )
    return list(result.scalars().all())


async def mark_web_lesson_complete(
    session: AsyncSession,
    web_user_id: int,
    lesson_id: str,
) -> TrainingProgress:
    # Check if already completed
    result = await session.execute(
        select(TrainingProgress).where(
            TrainingProgress.web_user_id == web_user_id,
            TrainingProgress.lesson_id == lesson_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    progress = TrainingProgress(
        web_user_id=web_user_id,
        lesson_id=lesson_id,
        completed_at=datetime.utcnow(),
    )
    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return progress
