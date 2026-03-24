"""
/ask handler — AI assistant chat mode with conversation history.
"""
import logging
from typing import List, Dict

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, CallbackQuery

from core.database import async_session_factory, get_or_create_user
from core.ai_analyzer import ask_assistant
from bot.utils import sanitize_html, md_to_html, safe_delete
from bot.handlers.analyze import _safe_split
from bot.keyboards import assistant_keyboard, cancel_keyboard, main_menu_keyboard

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"
MAX_HISTORY = 5  # Keep last N exchanges (user + assistant = 2 messages each)


class AssistantStates(StatesGroup):
    chatting = State()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _welcome_assistant_text(first_name: str, exp_level: str = None, play_style: str = None) -> str:
    profile_info = ""
    if exp_level or play_style:
        parts = []
        if exp_level:
            parts.append(f"уровень: <b>{exp_level}</b>")
        if play_style:
            parts.append(f"стиль: <b>{play_style}</b>")
        profile_info = f"\n\n👤 Твой профиль: {', '.join(parts)}"

    return (
        f"❓ <b>AI ТРЕНЕР ОНЛАЙН</b>\n\n"
        f"👋 <b>Привет, {first_name}!</b>\n\n"
        f"{DIVIDER}\n\n"
        f"Я готов ответить на любые вопросы о покере:\n\n"
        f"🎯 Стратегия и тактика\n"
        f"🃏 Разбор конкретных ситуаций\n"
        f"📊 GTO и эксплуатационная игра\n"
        f"💰 Банкролл-менеджмент\n"
        f"🧠 Mental game\n"
        f"📈 Любые другие аспекты покера\n"
        f"{profile_info}\n\n"
        f"{DIVIDER}\n\n"
        f"<i>Просто напиши свой вопрос на русском языке.</i>\n"
        f"Нажми ❌ <b>Отмена</b> чтобы выйти."
    )


# ── Handlers ──────────────────────────────────────────────────────────────────

@router.message(Command("ask"))
async def cmd_ask(message: Message, state: FSMContext) -> None:
    await state.clear()

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
        exp_level = user.experience_level
        play_style = user.play_style

    first_name = message.from_user.first_name or "Игрок"
    await state.set_state(AssistantStates.chatting)
    await state.update_data(history=[], exp_level=exp_level, play_style=play_style)

    await message.answer(
        _welcome_assistant_text(first_name, exp_level, play_style),
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.callback_query(F.data == "ask_question")
async def cb_ask_question(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.clear()

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        exp_level = user.experience_level
        play_style = user.play_style

    first_name = callback.from_user.first_name or "Игрок"
    await state.set_state(AssistantStates.chatting)
    await state.update_data(history=[], exp_level=exp_level, play_style=play_style)

    await callback.message.answer(
        _welcome_assistant_text(first_name, exp_level, play_style),
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.callback_query(F.data == "clear_chat")
async def cb_clear_chat(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer("🧹 История очищена")

    data = await state.get_data()
    exp_level = data.get("exp_level")
    play_style = data.get("play_style")

    await state.update_data(history=[])

    await callback.message.answer(
        f"🧹 <b>История диалога очищена.</b>\n\n"
        f"{DIVIDER}\n\n"
        f"Задавай новый вопрос:",
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.message(AssistantStates.chatting)
async def process_question(message: Message, state: FSMContext) -> None:
    question = message.text or ""
    if not question.strip():
        return

    data = await state.get_data()
    history: List[Dict] = data.get("history", [])
    exp_level = data.get("exp_level")
    play_style = data.get("play_style")

    status_msg = await message.answer(
        f"💭 <i>AI тренер думает...</i>",
        parse_mode="HTML",
    )

    try:
        answer = await ask_assistant(
            question=question,
            experience_level=exp_level,
            play_style=play_style,
            conversation_history=history,
        )

        # Update conversation history
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": answer})

        # Keep only last MAX_HISTORY exchanges
        max_messages = MAX_HISTORY * 2
        if len(history) > max_messages:
            history = history[-max_messages:]

        await state.update_data(history=history)

        await status_msg.delete()

        formatted = sanitize_html(md_to_html(answer))
        response_text = (
            f"🎓 <b>AI Тренер</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{formatted}"
        )

        chunks = _safe_split(response_text)
        for i, chunk in enumerate(chunks):
            kb = assistant_keyboard() if i == len(chunks) - 1 else None
            await message.answer(chunk, parse_mode="HTML", reply_markup=kb)

    except Exception as exc:
        logger.exception("Error in assistant: %s", exc)
        try:
            await status_msg.delete()
        except Exception:
            pass
        await message.answer(
            f"❌ <b>Произошла ошибка.</b>\n\nПопробуйте ещё раз.\n"
            f"<code>{str(exc)[:150]}</code>",
            parse_mode="HTML",
            reply_markup=assistant_keyboard(),
        )


@router.message(F.text & ~F.text.startswith("/"))
async def handle_free_text(message: Message, state: FSMContext) -> None:
    """Handle any free text not in another state — treat as assistant question."""
    current_state = await state.get_state()

    # Only intercept if not already in another active state
    if current_state is not None:
        return

    text = message.text or ""
    if len(text.strip()) < 3:
        return

    # Activate assistant mode automatically
    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
        exp_level = user.experience_level
        play_style = user.play_style

    await state.set_state(AssistantStates.chatting)
    await state.update_data(history=[], exp_level=exp_level, play_style=play_style)

    status_msg = await message.answer(
        f"💭 <i>AI тренер думает...</i>",
        parse_mode="HTML",
    )

    try:
        answer = await ask_assistant(
            question=text,
            experience_level=exp_level,
            play_style=play_style,
        )

        history = [
            {"role": "user", "content": text},
            {"role": "assistant", "content": answer},
        ]
        await state.update_data(history=history)

        await status_msg.delete()

        formatted = sanitize_html(md_to_html(answer))
        response_text = (
            f"🎓 <b>AI Тренер</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{formatted}"
        )

        chunks = _safe_split(response_text)
        for i, chunk in enumerate(chunks):
            kb = assistant_keyboard() if i == len(chunks) - 1 else None
            await message.answer(chunk, parse_mode="HTML", reply_markup=kb)
    except Exception as exc:
        logger.exception("Error in free text assistant: %s", exc)
        try:
            await status_msg.delete()
        except Exception:
            pass
        await message.answer(
            f"❌ Произошла ошибка. Попробуйте ещё раз.",
            parse_mode="HTML",
            reply_markup=main_menu_keyboard(),
        )
        await state.clear()
