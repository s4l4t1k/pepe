"""
/history handler — shows the last 5 analyzed hands.
"""
import json
import logging
from datetime import datetime

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery

from core.database import async_session_factory, get_or_create_user, get_user_hands
from bot.keyboards import history_keyboard

logger = logging.getLogger(__name__)

router = Router()

DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━"


def _format_date(dt: datetime) -> str:
    return dt.strftime("%d.%m.%Y %H:%M")


def _get_hand_summary(hand) -> str:
    """Extract a brief summary from the stored hand record."""
    cards_str = "—"
    stake_str = ""
    leak_str = ""
    score_str = ""

    if hand.hand_text == "[SCREENSHOT]":
        cards_str = "📸 Скриншот"
    elif hand.parsed_data:
        try:
            parsed = json.loads(hand.parsed_data)
            hero_cards = parsed.get("hero_cards") or []
            if hero_cards:
                cards_str = " ".join(hero_cards)
            stakes = parsed.get("stakes") or ""
            if stakes:
                stake_str = f" <i>[{stakes}]</i>"
        except Exception:
            pass

    if hand.analysis:
        try:
            analysis = json.loads(hand.analysis)
            leak = analysis.get("main_leak") or ""
            if leak:
                leak_str = leak[:80] + ("..." if len(leak) > 80 else "")
            score = analysis.get("overall_score") or ""
            if score:
                score_map = {"хорошо": "🟢", "удовлетворительно": "🟡", "плохо": "🔴"}
                for k, v in score_map.items():
                    if k in score.lower():
                        score_str = f" {v} {score}"
                        break
                if not score_str:
                    score_str = f" 📊 {score}"
        except Exception:
            pass

    summary = f"🃏 <b>{cards_str}</b>{stake_str}{score_str}"
    if leak_str:
        summary += f"\n<i>⚠️ {leak_str}</i>"
    return summary


def _build_history_text(hands) -> str:
    lines = [
        "📋 <b>ИСТОРИЯ РАЗДАЧ</b>\n",
        f"{DIVIDER}\n",
    ]
    for i, hand in enumerate(hands, start=1):
        date_str = _format_date(hand.created_at)
        summary = _get_hand_summary(hand)
        lines.append(f"<b>{i}.</b> 🕐 {date_str}\n{summary}\n")
        lines.append(f"{DIVIDER}")

    return "\n".join(lines)


@router.message(Command("history"))
async def cmd_history(message: Message) -> None:
    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
        hands = await get_user_hands(session, user_id=user.id, limit=5)

    if not hands:
        await message.answer(
            f"📋 <b>ИСТОРИЯ РАЗДАЧ</b>\n\n"
            f"📭 <b>История раздач пуста</b>\n\n"
            f"{DIVIDER}\n\n"
            f"Вы ещё не анализировали раздачи.\n"
            f"Используйте /analyze чтобы начать!",
            parse_mode="HTML",
            reply_markup=history_keyboard(),
        )
        return

    await message.answer(
        _build_history_text(hands),
        parse_mode="HTML",
        reply_markup=history_keyboard(),
    )


@router.callback_query(F.data == "show_history")
async def cb_show_history(callback: CallbackQuery) -> None:
    await callback.answer()

    async with async_session_factory() as session:
        user = await get_or_create_user(
            session,
            telegram_id=callback.from_user.id,
            username=callback.from_user.username,
            first_name=callback.from_user.first_name,
        )
        hands = await get_user_hands(session, user_id=user.id, limit=5)

    if not hands:
        await callback.message.answer(
            f"📋 <b>ИСТОРИЯ РАЗДАЧ</b>\n\n"
            f"📭 <b>История раздач пуста</b>\n\n"
            f"Вы ещё не анализировали раздачи.\n"
            f"Используйте /analyze чтобы начать!",
            parse_mode="HTML",
            reply_markup=history_keyboard(),
        )
        return

    await callback.message.answer(
        _build_history_text(hands),
        parse_mode="HTML",
        reply_markup=history_keyboard(),
    )
