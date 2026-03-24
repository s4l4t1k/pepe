"""
/analyze handler — text hand analysis + photo screenshot analysis.
"""
import asyncio
import json
import logging
from typing import Optional

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, CallbackQuery

from core.database import (
    async_session_factory,
    get_or_create_user,
    get_user_by_telegram_id,
    save_hand,
)
from core.parser import parse_hand
from bot.utils import sanitize_html, safe_delete, animated_loading
from core.ai_analyzer import analyze_hand, analyze_screenshot
from bot.keyboards import analyze_again_keyboard, cancel_keyboard, retry_analyze_keyboard
from models.schemas import ParsedHand, AnalysisResult

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"


class AnalyzeStates(StatesGroup):
    waiting_for_hand = State()
    waiting_for_photo = State()


# ── Formatting helpers ───────────────────────────────────────────────────────

def _fmt_cards(cards: Optional[list]) -> str:
    if not cards:
        return "—"
    return " ".join(cards)


def _section(title: str, body: str) -> str:
    if not body or not body.strip():
        return ""
    return f"\n<b>{title}</b>\n{sanitize_html(body)}\n"


def _score_emoji(score: Optional[str]) -> str:
    if not score:
        return ""
    s = score.lower()
    if "хорошо" in s:
        return "🟢"
    if "удовлетворительно" in s:
        return "🟡"
    if "плохо" in s:
        return "🔴"
    return "📊"


def _format_analysis(parsed: ParsedHand, analysis: AnalysisResult) -> str:
    parts = [
        "🃏 <b>АНАЛИЗ РАЗДАЧИ</b>\n"
    ]

    # Hand summary
    summary_lines = []
    if parsed.stakes:
        summary_lines.append(f"📌 Лимит: <b>{parsed.stakes}</b>")
    if parsed.hero_cards:
        summary_lines.append(f"🃏 Карты Hero: <b>{_fmt_cards(parsed.hero_cards)}</b>")
    if parsed.hero_position:
        summary_lines.append(f"📍 Позиция: <b>{parsed.hero_position}</b>")
    if parsed.stack_bb:
        summary_lines.append(f"💰 Стек: <b>{parsed.stack_bb} bb</b>")
    if parsed.board:
        summary_lines.append(f"🎴 Борд: <b>{_fmt_cards(parsed.board)}</b>")
    if parsed.pot_bb:
        summary_lines.append(f"🏦 Банк: <b>{parsed.pot_bb} bb</b>")

    if summary_lines:
        parts.append(DIVIDER + "\n📋 <b>Информация о раздаче</b>\n" + DIVIDER)
        parts.append("\n".join(summary_lines) + "\n")

    if analysis.overall_score:
        emoji = _score_emoji(analysis.overall_score)
        parts.append(f"\n{DIVIDER}")
        parts.append(f"{emoji} <b>Оценка раздачи:</b> {analysis.overall_score}")
        parts.append(DIVIDER + "\n")

    s = _section("🎯 Префлоп", analysis.preflop)
    if s:
        parts.append(s)

    s = _section("🟢 Флоп", analysis.flop)
    if s:
        parts.append(s)

    s = _section("🔵 Тёрн", analysis.turn)
    if s:
        parts.append(s)

    s = _section("🔴 Ривер", analysis.river)
    if s:
        parts.append(s)

    if analysis.main_leak:
        parts.append(f"\n{DIVIDER}")
        parts.append(f"⚠️ <b>Главная ошибка:</b>")
        parts.append(sanitize_html(analysis.main_leak))
        parts.append(DIVIDER + "\n")

    if analysis.recommended_line:
        parts.append(f"✅ <b>Рекомендуемая линия:</b>")
        parts.append(sanitize_html(analysis.recommended_line))
        parts.append("\n" + DIVIDER)

    if analysis.ev_estimate:
        parts.append(f"\n📈 <b>EV оценка:</b>")
        parts.append(sanitize_html(analysis.ev_estimate))
        parts.append(DIVIDER)

    return "\n".join(parts)


def _safe_split(text: str, limit: int = 4096) -> list[str]:
    """Split text at newline boundaries without breaking HTML tags."""
    if len(text) <= limit:
        return [text]
    parts = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut == -1:
            cut = limit
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    if text:
        parts.append(text)
    return parts


def _format_screenshot_analysis(analysis: AnalysisResult) -> str:
    parts = [
        "📸 <b>АНАЛИЗ СКРИНШОТА</b>\n"
    ]

    if analysis.overall_score:
        emoji = _score_emoji(analysis.overall_score)
        parts.append(f"{DIVIDER}")
        parts.append(f"{emoji} <b>Оценка ситуации:</b> {analysis.overall_score}")
        parts.append(DIVIDER + "\n")

    s = _section("🎯 Префлоп", analysis.preflop)
    if s:
        parts.append(s)

    s = _section("🟢 Флоп", analysis.flop)
    if s:
        parts.append(s)

    s = _section("🔵 Тёрн", analysis.turn)
    if s:
        parts.append(s)

    s = _section("🔴 Ривер", analysis.river)
    if s:
        parts.append(s)

    if analysis.main_leak:
        parts.append(f"{DIVIDER}")
        parts.append(f"⚠️ <b>Рекомендация:</b>")
        parts.append(analysis.main_leak.strip())
        parts.append(DIVIDER + "\n")

    if analysis.recommended_line:
        parts.append(f"✅ <b>Что делать:</b>")
        parts.append(analysis.recommended_line.strip())
        parts.append("\n" + DIVIDER)

    return "\n".join(parts)


# ── Text hand analysis ────────────────────────────────────────────────────────

@router.message(Command("analyze"))
async def cmd_analyze(message: Message, state: FSMContext) -> None:
    await state.set_state(AnalyzeStates.waiting_for_hand)
    await message.answer(
        f"🃏 <b>АНАЛИЗ РАЗДАЧИ</b>\n\n"
        f"📋 <b>Отправьте текст раздачи</b>\n\n"
        f"{DIVIDER}\n\n"
        f"<b>Поддерживаемые форматы:</b>\n"
        f"• Структурированный текст (NL100, Hero: AhKh, ...)\n"
        f"• PokerStars hand history\n\n"
        f"Нажмите ❌ <b>Отмена</b> чтобы прервать.",
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.callback_query(F.data == "analyze_new")
async def cb_analyze_new(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.set_state(AnalyzeStates.waiting_for_hand)
    await callback.message.answer(
        f"🃏 <b>АНАЛИЗ РАЗДАЧИ</b>\n\n"
        f"📋 <b>Отправьте текст раздачи</b>\n\n"
        f"{DIVIDER}\n\n"
        f"<b>Поддерживаемые форматы:</b>\n"
        f"• Структурированный текст (NL100, Hero: AhKh, ...)\n"
        f"• PokerStars hand history\n\n"
        f"Нажмите ❌ <b>Отмена</b> чтобы прервать.",
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.message(AnalyzeStates.waiting_for_hand)
async def process_hand_text(message: Message, state: FSMContext) -> None:
    await state.clear()

    hand_text = message.text or ""
    if len(hand_text.strip()) < 10:
        await message.answer(
            "⚠️ Текст раздачи слишком короткий. Пожалуйста, отправьте полный текст раздачи.",
            parse_mode="HTML",
        )
        return

    header = "⏳ <b>Анализирую раздачу...</b>\n<i>AI изучает твою линию...</i>"
    status_msg = await message.answer(header, parse_mode="HTML")

    stop_event = asyncio.Event()
    tip_task = asyncio.create_task(animated_loading(status_msg, header, stop_event))

    try:
        parsed = parse_hand(hand_text)

        if parsed.parse_error and not parsed.actions and not parsed.hero_cards:
            stop_event.set()
            await tip_task
            await safe_delete(status_msg)
            await message.answer(
                f"❌ <b>Не удалось разобрать раздачу</b>\n\n"
                f"Ошибка: {parsed.parse_error}\n\n"
                f"Проверьте формат и попробуйте снова. Используйте /help для примеров.",
                parse_mode="HTML",
            )
            return

        # Get user profile for context
        exp_level = None
        play_style = None
        async with async_session_factory() as session:
            user = await get_or_create_user(
                session,
                telegram_id=message.from_user.id,
                username=message.from_user.username,
                first_name=message.from_user.first_name,
            )
            exp_level = user.experience_level
            play_style = user.play_style
            user_id = user.id

        async def on_retry_hand(attempt, total):
            try:
                await status_msg.edit_text(
                    f"🔄 <b>Повторная попытка {attempt}/{total}...</b>\n<i>Соединяюсь с AI заново</i>",
                    parse_mode="HTML",
                )
            except Exception:
                pass

        analysis = await analyze_hand(parsed, on_retry=on_retry_hand)

        stop_event.set()
        await tip_task

        async with async_session_factory() as session:
            await save_hand(
                session,
                user_id=user_id,
                hand_text=hand_text,
                parsed_data_json=parsed.model_dump_json(),
                analysis_json=analysis.model_dump_json(),
            )

        await safe_delete(status_msg)
        result_text = _format_analysis(parsed, analysis)

        chunks = _safe_split(result_text)
        for i, chunk in enumerate(chunks):
            kb = analyze_again_keyboard() if i == len(chunks) - 1 else None
            await message.answer(chunk, parse_mode="HTML", reply_markup=kb)

    except Exception as exc:
        stop_event.set()
        await tip_task
        logger.exception("Error during hand analysis: %s", exc)
        await safe_delete(status_msg)
        await message.answer(
            "❌ <b>Не удалось проанализировать раздачу.</b>\n\n"
            "AI не ответил после 3 попыток. Нажми <b>Повторить</b>.",
            parse_mode="HTML",
            reply_markup=retry_analyze_keyboard(),
        )


# ── Screenshot analysis ───────────────────────────────────────────────────────

@router.callback_query(F.data == "analyze_screen")
async def cb_analyze_screen(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.set_state(AnalyzeStates.waiting_for_photo)
    await callback.message.answer(
        f"📸 <b>АНАЛИЗ СКРИНШОТА</b>\n\n"
        f"📸 <b>Отправьте скриншот покерного стола</b>\n\n"
        f"{DIVIDER}\n\n"
        f"AI-тренер проанализирует ситуацию на столе:\n"
        f"• Позиции игроков\n"
        f"• Карты и борд\n"
        f"• Стеки и поты\n"
        f"• Видимые действия\n\n"
        f"Нажмите ❌ <b>Отмена</b> чтобы прервать.",
        parse_mode="HTML",
        reply_markup=cancel_keyboard(),
    )


@router.message(F.photo)
async def process_photo(message: Message, state: FSMContext) -> None:
    """Handle any incoming photo — analyze as poker screenshot."""
    current_state = await state.get_state()

    # If in text-hand waiting state, handle gracefully
    if current_state == AnalyzeStates.waiting_for_hand.state:
        await state.clear()

    # Get the highest quality photo
    photo = message.photo[-1]

    header = "⏳ <b>Анализирую скриншот...</b>\n<i>AI изучает покерную ситуацию...</i>"
    status_msg = await message.answer(header, parse_mode="HTML")

    stop_event = asyncio.Event()
    tip_task = asyncio.create_task(animated_loading(status_msg, header, stop_event))

    try:
        # Get user profile
        exp_level = None
        play_style = None
        user_id = None
        async with async_session_factory() as session:
            user = await get_or_create_user(
                session,
                telegram_id=message.from_user.id,
                username=message.from_user.username,
                first_name=message.from_user.first_name,
            )
            exp_level = user.experience_level
            play_style = user.play_style
            user_id = user.id

        # Download photo bytes
        file = await message.bot.get_file(photo.file_id)
        file_bytes = await message.bot.download_file(file.file_path)
        image_bytes = file_bytes.read()

        async def on_retry_screen(attempt, total):
            try:
                await status_msg.edit_text(
                    f"🔄 <b>Повторная попытка {attempt}/{total}...</b>\n<i>Соединяюсь с AI заново</i>",
                    parse_mode="HTML",
                )
            except Exception:
                pass

        analysis = await analyze_screenshot(
            image_bytes=image_bytes,
            experience_level=exp_level,
            play_style=play_style,
            on_retry=on_retry_screen,
        )

        stop_event.set()
        await tip_task

        # Save to DB as a screenshot hand
        async with async_session_factory() as session:
            await save_hand(
                session,
                user_id=user_id,
                hand_text="[SCREENSHOT]",
                parsed_data_json="{}",
                analysis_json=analysis.model_dump_json(),
            )

        await safe_delete(status_msg)
        await state.clear()

        result_text = _format_screenshot_analysis(analysis)
        chunks = _safe_split(result_text)
        for i, chunk in enumerate(chunks):
            kb = analyze_again_keyboard() if i == len(chunks) - 1 else None
            await message.answer(chunk, parse_mode="HTML", reply_markup=kb)

    except Exception as exc:
        stop_event.set()
        await tip_task
        logger.exception("Error during screenshot analysis: %s", exc)
        await safe_delete(status_msg)
        await state.clear()
        await message.answer(
            "❌ <b>Не удалось проанализировать скриншот.</b>\n\n"
            "AI не ответил после 3 попыток. Нажми <b>Повторить</b>.",
            parse_mode="HTML",
            reply_markup=retry_analyze_keyboard(),
        )


# ── Cancel ────────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "cancel_input")
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.answer("Отменено")
    await callback.message.answer(
        "❌ Операция отменена.\n\nИспользуйте /analyze или /start для начала.",
        parse_mode="HTML",
    )
