"""
/start handler — multi-step FSM registration and main menu.
"""
import logging
import os

from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, CallbackQuery, FSInputFile

from core.database import (
    async_session_factory,
    get_or_create_user,
    get_user_by_telegram_id,
    update_user_profile,
)
from bot.keyboards import (
    main_menu_keyboard,
    phone_keyboard,
    remove_keyboard,
    experience_keyboard,
    play_style_keyboard,
)

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"
HEADER = "🃏 <b>POKER COACH AI</b>"

TRAINER_PHOTO = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "trainer.jpg")

EXPERIENCE_LABELS = {
    "beginner": "🟢 Новичок",
    "amateur": "🟡 Любитель",
    "semipro": "🔵 Полурег",
    "pro": "🔴 Регуляр",
}

STYLE_LABELS = {
    "lag": "🦁 LAG",
    "tag": "🐢 TAG",
    "lap": "🦊 LAP",
    "tap": "🛡️ TAP",
    "unknown": "🤔 Не определён",
}


class RegStates(StatesGroup):
    waiting_phone = State()
    waiting_experience = State()
    waiting_style = State()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _main_menu_text(first_name: str) -> str:
    return (
        f"{HEADER}\n\n"
        f"👋 <b>С возвращением, {first_name}!</b>\n\n"
        f"{DIVIDER}\n"
        f"🎮 <b>ГЛАВНОЕ МЕНЮ</b>\n"
        f"{DIVIDER}\n\n"
        f"Выбери действие ниже:"
    )


def _welcome_text() -> str:
    return (
        f"🤖 <b>POKER COACH AI</b>\n"
        f"<i>Твой персональный тренер по покеру</i>\n\n"
        f"{DIVIDER}\n\n"
        f"Привет! Я AI-тренер нового поколения.\n"
        f"Помогу тебе выйти на новый уровень игры:\n\n"
        f"🃏 <b>Разбор раздач</b> — EV, ошибки, оптимальная линия\n"
        f"📸 <b>Анализ скринов</b> — загрузи фото стола\n"
        f"📚 <b>Обучение</b> — 4 модуля, 15 уроков с квизами\n"
        f"💬 <b>AI-ответы</b> — задай любой вопрос о покере\n"
        f"📊 <b>Прогресс</b> — отслеживай рост своего уровня\n\n"
        f"{DIVIDER}\n\n"
        f"Для персонализации нужна короткая регистрация.\n"
        f"<i>Займёт 30 секунд</i> 🚀"
    )


def _profile_complete_text(first_name: str, exp: str, style: str) -> str:
    exp_label = EXPERIENCE_LABELS.get(exp, exp)
    style_label = STYLE_LABELS.get(style, style)
    return (
        f"{HEADER}\n\n"
        f"✅ <b>Профиль создан!</b>\n\n"
        f"{DIVIDER}\n"
        f"👤 <b>Твой профиль</b>\n"
        f"{DIVIDER}\n\n"
        f"🎮 Имя: <b>{first_name}</b>\n"
        f"🎓 Опыт: <b>{exp_label}</b>\n"
        f"🎭 Стиль: <b>{style_label}</b>\n\n"
        f"{DIVIDER}\n\n"
        f"🚀 Всё готово! Я адаптирую все объяснения\n"
        f"и рекомендации под твой уровень и стиль игры.\n\n"
        f"<i>Выбери с чего хочешь начать:</i>"
    )


# ── Command handlers ──────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    tg_id = message.from_user.id
    first_name = message.from_user.first_name or "Игрок"

    async with async_session_factory() as session:
        user = await get_user_by_telegram_id(session, tg_id)

    if user and user.experience_level and user.play_style:
        # Already registered — show main menu
        await message.answer(
            _main_menu_text(first_name),
            parse_mode="HTML",
            reply_markup=main_menu_keyboard(),
        )
    else:
        # New user or incomplete registration — start registration flow
        if os.path.exists(TRAINER_PHOTO):
            await message.answer_photo(
                FSInputFile(TRAINER_PHOTO),
                caption=_welcome_text(),
                parse_mode="HTML",
            )
        else:
            await message.answer(
                _welcome_text(),
                parse_mode="HTML",
            )
        # Create user record first
        async with async_session_factory() as session:
            await get_or_create_user(
                session,
                telegram_id=tg_id,
                username=message.from_user.username,
                first_name=first_name,
            )
        # Ask for phone
        await message.answer(
            f"📱 <b>Шаг 1 из 3</b>\n\n"
            f"{DIVIDER}\n\n"
            f"Поделись своим номером телефона или нажми «Пропустить».\n\n"
            f"<i>Это поможет идентифицировать твой аккаунт.</i>",
            parse_mode="HTML",
            reply_markup=phone_keyboard(),
        )
        await state.set_state(RegStates.waiting_phone)


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    text = (
        f"{HEADER}\n\n"
        f"📖 <b>Справка по командам</b>\n\n"
        f"{DIVIDER}\n\n"
        f"/start — главное меню\n"
        f"/analyze — анализ раздачи\n"
        f"/training — программа обучения\n"
        f"/ask — задать вопрос AI-тренеру\n"
        f"/progress — мой прогресс\n"
        f"/history — история раздач\n"
        f"/help — эта справка\n\n"
        f"{DIVIDER}\n\n"
        f"<b>Поддерживаемые форматы раздач:</b>\n"
        f"• Структурированный текст (NL100, Hero: AhKh, ...)\n"
        f"• PokerStars hand history\n"
        f"• Скриншоты покерных столов 📸\n\n"
        f"<b>Что анализирует AI:</b>\n"
        f"✅ Префлоп действия\n"
        f"✅ Постфлоп по улицам\n"
        f"✅ Главные ошибки (утечки)\n"
        f"✅ Рекомендуемая линия игры\n"
        f"✅ Общая оценка раздачи"
    )
    await message.answer(text, parse_mode="HTML", reply_markup=main_menu_keyboard())


# ── Registration FSM steps ────────────────────────────────────────────────────

@router.message(RegStates.waiting_phone)
async def reg_phone(message: Message, state: FSMContext) -> None:
    tg_id = message.from_user.id
    phone = None

    if message.contact:
        phone = message.contact.phone_number
    elif message.text and message.text.strip() != "⏭ Пропустить":
        # Manual phone input
        raw = message.text.strip().replace(" ", "").replace("-", "")
        if raw.lstrip("+").isdigit() and 7 <= len(raw.lstrip("+")) <= 15:
            phone = raw

    if phone:
        async with async_session_factory() as session:
            await update_user_profile(session, tg_id, phone=phone)
        await state.update_data(phone=phone)

    await message.answer(
        f"🎓 <b>Шаг 2 из 3</b>\n\n"
        f"{DIVIDER}\n\n"
        f"Какой у тебя опыт в покере?",
        parse_mode="HTML",
        reply_markup=remove_keyboard(),
    )
    await message.answer(
        "Выбери свой уровень:",
        reply_markup=experience_keyboard(),
    )
    await state.set_state(RegStates.waiting_experience)


@router.callback_query(RegStates.waiting_experience, F.data.startswith("exp_"))
async def reg_experience(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    exp = callback.data.replace("exp_", "")
    await state.update_data(experience=exp)

    tg_id = callback.from_user.id
    async with async_session_factory() as session:
        await update_user_profile(session, tg_id, experience_level=exp)

    await callback.message.answer(
        f"🎭 <b>Шаг 3 из 3</b>\n\n"
        f"{DIVIDER}\n\n"
        f"Какой у тебя стиль игры?",
        parse_mode="HTML",
    )
    await callback.message.answer(
        "Выбери свой стиль:",
        reply_markup=play_style_keyboard(),
    )
    await state.set_state(RegStates.waiting_style)


@router.callback_query(RegStates.waiting_style, F.data.startswith("style_"))
async def reg_style(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    style = callback.data.replace("style_", "")

    tg_id = callback.from_user.id
    first_name = callback.from_user.first_name or "Игрок"

    async with async_session_factory() as session:
        await update_user_profile(session, tg_id, play_style=style)

    data = await state.get_data()
    exp = data.get("experience", "unknown")

    await state.clear()

    await callback.message.answer(
        _profile_complete_text(first_name, exp, style),
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


# ── Main menu callback ─────────────────────────────────────────────────────

@router.callback_query(F.data == "main_menu")
async def cb_main_menu(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.clear()
    first_name = callback.from_user.first_name or "Игрок"
    await callback.message.answer(
        _main_menu_text(first_name),
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )
