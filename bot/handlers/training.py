"""
/training handler — full poker curriculum with dynamic AI lesson generation.
"""
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery

from core.database import (
    async_session_factory,
    get_or_create_user,
    get_user_by_telegram_id,
    get_completed_lessons,
    mark_lesson_complete,
)
from core.ai_analyzer import generate_lesson
from bot.utils import sanitize_html, safe_delete, animated_loading, md_to_html
from bot.handlers.analyze import _safe_split
from bot.keyboards import (
    training_menu_keyboard,
    module_lessons_keyboard,
    lesson_done_keyboard,
    retry_lesson_keyboard,
    quiz_keyboard,
    MODULES,
    LESSONS,
    LESSON_TOPICS,
    main_menu_keyboard,
)

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"

MODULE_NAMES = {mod_id: name for name, mod_id in MODULES}

LESSON_TO_MODULE = {}
for mod_id, lessons in LESSONS.items():
    for _, lesson_id in lessons:
        LESSON_TO_MODULE[lesson_id] = mod_id


# ── Helpers ──────────────────────────────────────────────────────────────────


def _training_menu_text(completed_count: int, total_count: int) -> str:
    progress_pct = int(completed_count / total_count * 100) if total_count else 0
    bar_filled = int(progress_pct / 10)
    bar = "█" * bar_filled + "░" * (10 - bar_filled)

    return (
        f"📚 <b>ПРОГРАММА ОБУЧЕНИЯ</b>\n\n"
        f"{DIVIDER}\n"
        f"📊 <b>Ваш прогресс</b>\n"
        f"{DIVIDER}\n\n"
        f"Пройдено уроков: <b>{completed_count}/{total_count}</b>\n"
        f"[{bar}] {progress_pct}%\n\n"
        f"{DIVIDER}\n\n"
        f"Выберите модуль для изучения:"
    )


def _fmt(text: str) -> str:
    return sanitize_html(md_to_html(text))


def _format_lesson(lesson_data: dict, lesson_id: str) -> str:
    title = sanitize_html(lesson_data.get("title", "Урок"))
    intro = sanitize_html(lesson_data.get("introduction", ""))
    theory = _fmt(lesson_data.get("theory", ""))
    key_concepts = [_fmt(c) for c in lesson_data.get("key_concepts", [])]
    practical_tips = [_fmt(t) for t in lesson_data.get("practical_tips", [])]

    LESSON_DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"

    parts = [
        f"📖 <b>{title}</b>\n"
        f"<i>{intro}</i>\n\n"
        f"{LESSON_DIVIDER}"
    ]

    if theory:
        parts.append(f"\n{theory}\n\n{LESSON_DIVIDER}")

    if key_concepts:
        parts.append("\n🔑 <b>Ключевые концепции:</b>")
        parts.extend(f"  • {c}" for c in key_concepts)
        parts.append("")

    if practical_tips:
        parts.append(f"{LESSON_DIVIDER}\n💡 <b>Практические советы:</b>")
        parts.extend(f"  ✅ {t}" for t in practical_tips)

    return "\n".join(parts)


def _format_quiz(lesson_data: dict, lesson_id: str) -> tuple[str, list, str]:
    question = sanitize_html(lesson_data.get("quiz_question", ""))
    options = [sanitize_html(o) for o in lesson_data.get("quiz_options", [])]
    correct = str(lesson_data.get("quiz_correct", "A")).strip().upper()[:1]
    # Normalize: accept "A)" or "A) text" → "A"
    if not correct or correct not in "ABCD":
        correct = "A"
    text = f"🎯 <b>Проверь себя:</b>\n\n❓ {question}"
    return text, options, correct


# ── Handlers ──────────────────────────────────────────────────────────────────

@router.message(Command("training"))
async def cmd_training(message: Message) -> None:
    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
        completed = await get_completed_lessons(session, user.id)

    total = sum(len(v) for v in LESSONS.values())

    await message.answer(
        _training_menu_text(len(completed), total),
        parse_mode="HTML",
        reply_markup=training_menu_keyboard(),
    )


@router.callback_query(F.data == "training_menu")
async def cb_training_menu(callback: CallbackQuery) -> None:
    await callback.answer()

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        completed = await get_completed_lessons(session, user.id)

    total = sum(len(v) for v in LESSONS.values())

    await safe_delete(callback.message)
    await callback.message.answer(
        _training_menu_text(len(completed), total),
        parse_mode="HTML",
        reply_markup=training_menu_keyboard(),
    )


@router.callback_query(F.data.startswith("training_mod"))
async def cb_module(callback: CallbackQuery) -> None:
    await callback.answer()
    module_id = callback.data.replace("training_", "")

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        completed = await get_completed_lessons(session, user.id)

    module_name = MODULE_NAMES.get(module_id, "Модуль")
    lessons = LESSONS.get(module_id, [])
    completed_in_module = sum(1 for _, lid in lessons if lid in completed)

    text = (
        f"📚 <b>МОДУЛЬ</b>\n\n"
        f"{DIVIDER}\n"
        f"<b>{module_name}</b>\n"
        f"{DIVIDER}\n\n"
        f"Пройдено: <b>{completed_in_module}/{len(lessons)}</b>\n\n"
        f"Выберите урок:"
    )

    await safe_delete(callback.message)
    await callback.message.answer(
        text,
        parse_mode="HTML",
        reply_markup=module_lessons_keyboard(module_id, completed),
    )


@router.callback_query(F.data.startswith("lesson_lesson_"))
async def cb_lesson(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer("⏳ Загружаю урок...")

    lesson_id = callback.data.removeprefix("lesson_")  # "lesson_lesson_1_1" → "lesson_1_1"
    topic = LESSON_TOPICS.get(lesson_id, "Покерная стратегия")

    # Get user profile
    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        exp_level = user.experience_level
        play_style = user.play_style

    await safe_delete(callback.message)

    header = "⏳ <b>Генерирую урок...</b>\n<i>AI создаёт персональный контент для тебя</i>"
    status_msg = await callback.message.answer(header, parse_mode="HTML")

    stop_event = asyncio.Event()
    tip_task = asyncio.create_task(animated_loading(status_msg, header, stop_event))

    async def on_retry(attempt, total):
        try:
            await status_msg.edit_text(
                f"🔄 <b>Повторная попытка {attempt}/{total}...</b>\n<i>Соединяюсь с AI заново</i>",
                parse_mode="HTML",
            )
        except Exception:
            pass

    try:
        lesson_data = await generate_lesson(
            topic=topic,
            lesson_id=lesson_id,
            experience_level=exp_level,
            play_style=play_style,
            on_retry=on_retry,
        )
    finally:
        stop_event.set()
        await tip_task

    await safe_delete(status_msg)

    module_id = LESSON_TO_MODULE.get(lesson_id, "mod1")

    if not lesson_data:
        await callback.message.answer(
            f"❌ <b>Не удалось загрузить урок.</b>\n\n"
            f"AI не ответил после {3} попыток. Нажми <b>Повторить</b> — обычно помогает.",
            parse_mode="HTML",
            reply_markup=retry_lesson_keyboard(lesson_id, module_id),
        )
        return

    lesson_text = _format_lesson(lesson_data, lesson_id)

    # Send lesson content
    for chunk in _safe_split(lesson_text):
        await callback.message.answer(chunk, parse_mode="HTML")

    # Send quiz — correct answer encoded in each button's callback_data (no FSM needed)
    quiz_text, quiz_options, quiz_correct = _format_quiz(lesson_data, lesson_id)

    # Store explanation in FSM only (needed after answer)
    await state.update_data(
        lesson_id=lesson_id,
        module_id=module_id,
        quiz_explanation=sanitize_html(lesson_data.get("quiz_explanation", "")),
    )

    if quiz_options:
        await callback.message.answer(
            quiz_text,
            parse_mode="HTML",
            reply_markup=quiz_keyboard(lesson_id, quiz_options, quiz_correct),
        )
    else:
        await callback.message.answer(
            f"{DIVIDER}\n\nОтличная работа! Нажми кнопку ниже чтобы отметить урок пройденным.",
            parse_mode="HTML",
            reply_markup=lesson_done_keyboard(lesson_id, module_id),
        )


@router.callback_query(F.data.startswith("qz_"))
async def cb_quiz_answer(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()

    # Format: qz_{lesson_id}_{chosen}_{correct}
    # lesson_id itself contains underscores (e.g. lesson_1_1), so split from right
    raw = callback.data  # e.g. "qz_lesson_1_1_B_A"
    # last two parts are chosen and correct
    parts = raw.split("_")
    correct = parts[-1].upper()        # "A"
    chosen = parts[-2].upper()         # "B"
    # lesson_id = everything between "qz_" and "_{chosen}_{correct}"
    lesson_id = "_".join(parts[1:-2])  # "lesson_1_1"

    data = await state.get_data()
    explanation = data.get("quiz_explanation", "")
    module_id = data.get("module_id", "mod1")

    if chosen == correct:
        result_text = f"✅ <b>Правильно!</b> Ответ <b>{correct}</b>"
    else:
        result_text = f"❌ <b>Неверно.</b> Правильный ответ: <b>{correct}</b>"

    if explanation:
        result_text += f"\n\n<i>{explanation}</i>"

    await callback.message.answer(
        result_text,
        parse_mode="HTML",
        reply_markup=lesson_done_keyboard(lesson_id, module_id),
    )


@router.callback_query(F.data.startswith("complete_lesson_"))
async def cb_complete_lesson(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer("✅ Урок отмечен пройденным!")
    lesson_id = callback.data.removeprefix("complete_")  # "complete_lesson_1_1" → "lesson_1_1"
    logger.debug("cb_complete_lesson: lesson_id=%s", lesson_id)

    try:
        async with async_session_factory() as session:
            user = await get_or_create_user(
                session,
                telegram_id=callback.from_user.id,
                username=callback.from_user.username,
                first_name=callback.from_user.first_name,
            )
            await mark_lesson_complete(session, user.id, lesson_id)
            completed = await get_completed_lessons(session, user.id)

        await state.clear()
        module_id = LESSON_TO_MODULE.get(lesson_id, "mod1")
        total = sum(len(v) for v in LESSONS.values())

        await callback.message.answer(
            f"🏆 <b>Урок завершён!</b>\n\n"
            f"📊 Пройдено: <b>{len(completed)}/{total}</b>",
            parse_mode="HTML",
            reply_markup=module_lessons_keyboard(module_id, completed),
        )
    except Exception as exc:
        logger.exception("cb_complete_lesson error: %s", exc)
        await callback.message.answer("❌ Не удалось сохранить прогресс. Попробуйте ещё раз.")
