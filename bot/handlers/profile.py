"""
/progress handler — user profile page with stats and streak.
"""
import logging
from datetime import datetime, timedelta

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery

from core.database import (
    async_session_factory,
    get_or_create_user,
    get_user_stats,
    get_completed_lessons,
)
from bot.keyboards import progress_keyboard, main_menu_keyboard, LESSONS

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"

EXPERIENCE_LABELS = {
    "beginner": "🟢 Новичок (< 1 года)",
    "amateur": "🟡 Любитель (1-3 года)",
    "semipro": "🔵 Полурег (3-5 лет)",
    "pro": "🔴 Регуляр (5+ лет)",
}

STYLE_LABELS = {
    "lag": "🦁 LAG (Loose-Aggressive)",
    "tag": "🐢 TAG (Tight-Aggressive)",
    "lap": "🦊 LAP (Loose-Passive)",
    "tap": "🛡️ TAP (Tight-Passive)",
    "unknown": "🤔 Стиль не определён",
}

MOTIVATIONAL_MESSAGES = {
    "beginner": [
        "🚀 Ты на правильном пути! Каждый профи когда-то был новичком.",
        "💪 Упорство — ключ к успеху в покере. Продолжай анализировать!",
        "🎯 Фокусируйся на фундаменте — позиции и диапазоны всё решают.",
    ],
    "amateur": [
        "📈 Хороший прогресс! Пора углублять знания постфлопа.",
        "🔥 Ты уже знаешь основы — теперь работай над тонкими ошибками.",
        "🎯 Любитель становится регуляром через постоянный анализ игры.",
    ],
    "semipro": [
        "⚡ Полурег — это серьёзно! Работай над GTO и балансом диапазонов.",
        "🏆 Ты уже выше среднего уровня. Следующий шаг — углубить эксплуатацию.",
        "📊 Анализируй статистику и ищи эксплойты против конкретных оппонентов.",
    ],
    "pro": [
        "👑 Профессиональный уровень! Тонкий анализ — твоё главное оружие.",
        "🎯 Регуляры выигрывают на дистанции через дисциплину и постоянное обучение.",
        "🚀 Всегда есть что улучшить. Продолжай анализировать каждую раздачу!",
    ],
}


def _get_motivational(exp_level: str) -> str:
    import random
    messages = MOTIVATIONAL_MESSAGES.get(exp_level, MOTIVATIONAL_MESSAGES["beginner"])
    return random.choice(messages)


def _days_since(dt: datetime) -> int:
    now = datetime.utcnow()
    delta = now - dt
    return delta.days


def _build_progress_bar(value: int, max_value: int, width: int = 10) -> str:
    if max_value == 0:
        pct = 0
    else:
        pct = min(100, int(value / max_value * 100))
    filled = int(pct / 100 * width)
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {pct}%"


def _format_progress_text(user, stats: dict, completed_lessons: list) -> str:
    first_name = user.first_name or "Игрок"
    exp = user.experience_level or "beginner"
    style = user.play_style or "unknown"
    hands_count = stats.get("hands_count", 0)
    lessons_count = len(completed_lessons)
    total_lessons = sum(len(v) for v in LESSONS.values())

    exp_label = EXPERIENCE_LABELS.get(exp, f"🎮 {exp}")
    style_label = STYLE_LABELS.get(style, f"🎭 {style}")

    days_active = _days_since(user.created_at) + 1

    motivation = _get_motivational(exp)

    lessons_bar = _build_progress_bar(lessons_count, total_lessons)
    hands_bar = _build_progress_bar(min(hands_count, 100), 100)

    # Achievement badges
    badges = []
    if hands_count >= 1:
        badges.append("🃏 Первый анализ")
    if hands_count >= 10:
        badges.append("🔟 10 раздач")
    if hands_count >= 50:
        badges.append("🏅 50 раздач")
    if hands_count >= 100:
        badges.append("🏆 100 раздач")
    if lessons_count >= 1:
        badges.append("📖 Первый урок")
    if lessons_count >= 5:
        badges.append("🎓 5 уроков")
    if lessons_count >= total_lessons:
        badges.append("👑 Все уроки!")

    badges_text = " ".join(badges) if badges else "Пока нет достижений"

    text = (
        f"📊 <b>МОЙ ПРОГРЕСС</b>\n\n"
        f"{DIVIDER}\n"
        f"👤 <b>Профиль</b>\n"
        f"{DIVIDER}\n\n"
        f"🎮 Имя: <b>{first_name}</b>\n"
        f"🎓 Уровень: {exp_label}\n"
        f"🎭 Стиль игры: {style_label}\n"
        f"📅 Дней с нами: <b>{days_active}</b>\n\n"
        f"{DIVIDER}\n"
        f"📈 <b>Статистика</b>\n"
        f"{DIVIDER}\n\n"
        f"🃏 Раздач проанализировано:\n"
        f"   <b>{hands_count}</b> {hands_bar}\n\n"
        f"📚 Уроков пройдено:\n"
        f"   <b>{lessons_count}/{total_lessons}</b> {lessons_bar}\n\n"
        f"{DIVIDER}\n"
        f"🏅 <b>Достижения</b>\n"
        f"{DIVIDER}\n\n"
        f"{badges_text}\n\n"
        f"{DIVIDER}\n"
        f"💬 <b>Совет тренера</b>\n"
        f"{DIVIDER}\n\n"
        f"<i>{motivation}</i>\n\n"
        f"{DIVIDER}"
    )
    return text


# ── Handlers ──────────────────────────────────────────────────────────────────

@router.message(Command("progress"))
async def cmd_progress(message: Message) -> None:
    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
        stats = await get_user_stats(session, user.id)
        completed = await get_completed_lessons(session, user.id)

    text = _format_progress_text(user, stats, completed)
    await message.answer(text, parse_mode="HTML", reply_markup=progress_keyboard())


@router.callback_query(F.data == "my_progress")
async def cb_my_progress(callback: CallbackQuery) -> None:
    await callback.answer()

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        stats = await get_user_stats(session, user.id)
        completed = await get_completed_lessons(session, user.id)

    text = _format_progress_text(user, stats, completed)
    await callback.message.answer(text, parse_mode="HTML", reply_markup=progress_keyboard())
