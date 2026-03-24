"""Shared utilities for bot handlers."""
import asyncio
import random
import re


def sanitize_html(text: str) -> str:
    """
    Clean AI-generated text for Telegram HTML parse mode.
    Replaces unsupported tags, keeps: <b> <i> <code> <pre> <u> <s> <a>.
    Escapes bare < and > that aren't part of allowed tags.
    """
    if not text:
        return text
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?p[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<h[1-4][^>]*>(.*?)</h[1-4]>", r"<b>\1</b>", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(?:ul|ol|li)[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(?!(?:b|i|code|pre|u|s|a)(?:\s|>|/))[a-z][^>]*>", "", text, flags=re.IGNORECASE)
    # Escape bare < that don't start an allowed Telegram HTML tag
    text = re.sub(r"<(?!/?(?:b|i|u|s|code|pre|a)[\s>])", "&lt;", text, flags=re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def md_to_html(text: str) -> str:
    """
    Convert AI markdown response to Telegram-compatible HTML.
    Handles: ###/##/# headings, **bold**, *italic*, `code`, ---, | tables |, - lists.
    """
    if not text:
        return text

    lines = text.split("\n")
    out = []
    in_table = False

    for line in lines:
        # Horizontal rule
        if re.match(r"^-{3,}$", line.strip()) or re.match(r"^_{3,}$", line.strip()) or re.match(r"^\*{3,}$", line.strip()):
            if in_table:
                out.append("</code>")
                in_table = False
            out.append("━━━━━━━━━━━━━━━━━━━━━━")
            continue

        # Table rows: | col | col |
        if line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(re.match(r"^[-: ]+$", c) for c in cells):
                # Separator row — skip
                continue
            row = "  │  ".join(cells)
            if not in_table:
                out.append("<code>")
                in_table = True
            out.append(row)
            continue
        else:
            if in_table:
                out.append("</code>")
                in_table = False

        # Headings: ###, ##, #
        m = re.match(r"^#{1,3}\s+(.+)$", line)
        if m:
            out.append(f"\n<b>{m.group(1)}</b>")
            continue

        # Process inline: **bold**, *italic*, `code`
        line = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
        line = re.sub(r"\*(.+?)\*", r"<i>\1</i>", line)
        line = re.sub(r"`([^`]+)`", r"<code>\1</code>", line)

        out.append(line)

    if in_table:
        out.append("</code>")

    result = "\n".join(out)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


async def safe_delete(message) -> None:
    """Try to delete a message, silently ignore errors."""
    try:
        await message.delete()
    except Exception:
        pass


# ── Animated loading tips ─────────────────────────────────────────────────────

POKER_TIPS = [
    "💡 <b>Позиция решает:</b> BTN открывает 45–50% рук в 6-max",
    "🎯 <b>C-bet:</b> на сухом борде T72r c-bet ~65–70%, на влажном A♥J♥T♥ ~40%",
    "📊 <b>Математика:</b> Флаш-дро = 9 аутов = ~35% на флопе",
    "🔑 <b>3-бет IP:</b> против BTN открытия 3-бети 9–12% рук с BTN+SB",
    "💰 <b>Банкролл:</b> Минимум 20 байинов для стабильной игры",
    "⚡ <b>GTO ривер:</b> Блефуй в пропорции 1:2 к вэлью при пот-сайзинге",
    "🧠 <b>Mental game:</b> EV, а не результат — вот что оцениваем",
    "📈 <b>Защита BB:</b> Защищай 40–45% против стила с BTN",
    "🃏 <b>Преимущество позиции:</b> IP = +2–3 bb/100 над OOP при прочих равных",
    "🎰 <b>Овербет:</b> Поляризованный рейндж → овербет 120–150% пота на ривере",
    "🔥 <b>Агрессия:</b> VPIP/PFR = 22/18 — оптимальный TAG-профиль",
    "🃏 <b>Implied odds:</b> Сет-майнинг окупается с 15x+ имплайд",
    "📐 <b>Сайзинг префлоп:</b> Открывайся на 2.5bb EP, 2bb BTN в 6-max",
    "🌊 <b>Wet board:</b> Сокращай c-bet размер на дроу-борде до 33–40%",
    "🎭 <b>Баланс блефов:</b> На каждую вэлью-руку — 1–2 блефа в диапазоне",
]


async def animated_loading(message, header: str, stop_event: asyncio.Event) -> None:
    """Edit message with rotating poker tips every 4 seconds."""
    tips = POKER_TIPS.copy()
    random.shuffle(tips)
    i = 0
    while not stop_event.is_set():
        await asyncio.sleep(4)
        if stop_event.is_set():
            break
        tip = tips[i % len(tips)]
        try:
            await message.edit_text(
                f"{header}\n\n{tip}",
                parse_mode="HTML",
            )
        except Exception:
            pass
        i += 1
