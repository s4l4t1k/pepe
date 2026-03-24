"""
DeepSeek API integration for poker hand analysis.
Model: deepseek-chat (OpenAI-compatible)
"""
import base64
import json
import logging
import os
from typing import Optional, List, Dict

from openai import AsyncOpenAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

from models.schemas import ParsedHand, AnalysisResult

load_dotenv()

MODEL = "deepseek-chat"
MODEL_VISION = "deepseek-chat"  # DeepSeek V3 supports vision via base64

# ── Trainer personality ───────────────────────────────────────────────────────

TRAINER_PERSONA = """Ты — Виктор, профессиональный тренер по покеру с 18-летним опытом.
Играл на лимитах до NL2000, работал с сотнями учеников — от новичков до регуляров.
Твой стиль: прямой, конкретный, требовательный но справедливый.
Ты говоришь как тренер на тренировке — без лишних слов, только суть.
Когда видишь ошибку — называешь прямо и объясняешь почему это стоит денег.
Когда действие правильное — подтверждаешь коротко с обоснованием.
Никогда не хвалишь просто так. Никогда не осуждаешь — только разбираешь ситуацию.
Всегда говоришь только на русском языке."""

# ── System prompts ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""{TRAINER_PERSONA}

Анализируй NL Hold'em кэш-раздачи. Коротко и по делу — максимум 1-2 предложения на поле.

ПРАВИЛА:
- Никаких вводных фраз
- Каждое поле: 1 конкретное утверждение с цифрой (диапазон %, сайзинг в bb)
- Ошибка: что не так + почему -EV в одном предложении
- Не используй markdown, звёздочки, хэштеги

Верни ТОЛЬКО валидный JSON без markdown-обёртки:
{{
  "preflop": "Позиция + оценка действия + цифра. Или пусто.",
  "flop": "Текстура + оценка cbet/чека + сайзинг. Или пусто.",
  "turn": "Оценка + рекомендация с сайзингом. Или пусто.",
  "river": "Оценка линии. Или пусто.",
  "main_leak": "[УЛИЦА] [ДЕЙСТВИЕ] — [ПОЧЕМУ -EV] — потеря ~X bb",
  "recommended_line": "Префлоп: X → Флоп: Y% → Тёрн: Z%",
  "ev_estimate": "текущая ~X bb/hand, оптимальная ~Y bb/hand",
  "overall_score": "Хорошо / Удовлетворительно / Плохо"
}}"""

SCREENSHOT_EXTRACT_PROMPT = """Ты эксперт по анализу покерных скриншотов.

Внимательно изучи скриншот покерного стола и извлеки ВСЮ доступную информацию.

Верни ТОЛЬКО валидный JSON без markdown-обёртки:
{
  "game_type": "Тип игры (NL Holdem, PLO и т.д.)",
  "stakes": "Ставки (например NL100, $0.50/$1.00)",
  "hero_cards": ["Карта1", "Карта2"],
  "hero_position": "Позиция Hero за столом",
  "stack_bb": "Стек Hero в BB (число)",
  "board": ["Карта борда 1", "Карта борда 2"],
  "street": "Текущая улица (preflop/flop/turn/river)",
  "pot_size": "Размер пота",
  "actions_visible": "Описание видимых действий игроков",
  "opponents": "Информация о видимых оппонентах (стеки, позиции)",
  "notes": "Любые дополнительные наблюдения"
}

Если поле не видно — оставь пустую строку или null.
Отвечай только на русском языке. НЕ добавляй ничего кроме JSON."""

ASSISTANT_SYSTEM_PROMPT = f"""{TRAINER_PERSONA}

ФОРМАТ:
- Без вводных фраз, без заключений, без звёздочек и markdown
- Коротко: 3-5 предложений максимум
- Конкретика: цифры, диапазоны, сайзинги

УРОВЕНЬ:
- Новичок: термины объясняй в скобках
- Любитель: без лишних объяснений, примеры с руками
- Полурег/Регуляр: технический язык, EV, GTO"""

LESSON_SYSTEM_PROMPT = f"""{TRAINER_PERSONA}

Ты создаёшь обучающий контент. Только факты.

ПРАВИЛА УРОКА — без воды:
- Теория: утверждение → пример с конкретными руками/сайзингами → вывод
- Концепции: короткие точные формулировки с цифрами
- Советы: действие + ситуация + результат
- Квиз: реальная покерная ситуация с цифрами

АДАПТАЦИЯ ЯЗЫКА (следуй инструкциям из профиля игрока):
- Новичок/beginner: каждый термин объясняй в скобках, язык максимально простой
- Любитель/amateur: термины с кратким пояснением в скобках при первом упоминании
- Полурег/semipro и выше: технический язык без пояснений

Верни ТОЛЬКО валидный JSON без markdown-обёртки:
{{
  "title": "Название урока",
  "introduction": "2 предложения: что изучим и почему важно для винрейта",
  "theory": "Теория с примерами. Конкретные руки, позиции, сайзинги, частоты.",
  "key_concepts": ["Концепция с числами 1", "Концепция с числами 2", "Концепция с числами 3"],
  "practical_tips": ["Конкретный совет с ситуацией 1", "Совет 2", "Совет 3"],
  "quiz_question": "Конкретная ситуация с цифрами — что делать?",
  "quiz_options": ["A) вариант", "B) вариант", "C) вариант", "D) вариант"],
  "quiz_correct": "A",
  "quiz_explanation": "Почему правильно: EV обоснование с числами"
}}"""


MAX_RETRIES = 3
RETRY_DELAY = 3.0

import asyncio as _asyncio


def _get_client() -> AsyncOpenAI:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    return AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")


async def _with_retry(fn, retries: int = MAX_RETRIES, on_retry=None):
    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            return await fn(attempt)
        except json.JSONDecodeError as exc:
            last_exc = exc
            logger.warning("Attempt %d/%d failed (JSONDecodeError): %s", attempt, retries, exc)
        except Exception as exc:
            # Retry on rate limit / server errors
            status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
            if status in (429, 500, 502, 503):
                last_exc = exc
                logger.warning("Attempt %d/%d failed (status %s): %s", attempt, retries, status, exc)
            else:
                raise
        if attempt < retries:
            if on_retry:
                try:
                    await on_retry(attempt + 1, retries)
                except Exception:
                    pass
            await _asyncio.sleep(RETRY_DELAY * attempt)
    raise last_exc


def _build_hand_message(parsed: ParsedHand) -> str:
    hand_dict = parsed.model_dump(exclude={"raw_text"})
    return (
        "Проанализируй эту раздачу:\n\n"
        f"```json\n{json.dumps(hand_dict, ensure_ascii=False, indent=2)}\n```\n\n"
        f"Исходный текст раздачи:\n{parsed.raw_text}"
    )


def _profile_context(experience_level: Optional[str], play_style: Optional[str]) -> str:
    parts = []
    if experience_level:
        parts.append(f"Уровень игрока: {experience_level}")
    if play_style:
        parts.append(f"Стиль игры: {play_style}")

    if experience_level in ("beginner", "новичок"):
        parts.append(
            "ЯЗЫК ОБЪЯСНЕНИЙ: Пиши максимально простым языком, без жаргона. "
            "КАЖДЫЙ покерный термин и аббревиатуру объясняй в скобках при первом упоминании. "
            "Примеры: EV (ожидаемая ценность — насколько выгодно решение в долгосроке), "
            "BTN (баттон — самая выгодная позиция за столом), "
            "3-бет (третья ставка в одном круге торговли — ответный рейз на рейз), "
            "cbet (продолжение-ставка на флопе от инициатора префлоп-агрессии). "
            "Давай конкретное правило 'по умолчанию' для начинающих."
        )
    elif experience_level in ("amateur", "любитель"):
        parts.append(
            "ЯЗЫК ОБЪЯСНЕНИЙ: Пиши понятно. При первом упоминании незнакомого термина "
            "добавляй краткое пояснение в скобках. "
            "Примеры: GTO (оптимальная стратегия), SPR (отношение стека к поту)."
        )

    if parts:
        return "\n\nПрофиль игрока:\n" + "\n".join(parts)
    return ""


def _error_result(msg: str, detail: str = "") -> AnalysisResult:
    return AnalysisResult(
        main_leak=msg,
        recommended_line="Попробуйте отправить раздачу ещё раз позже",
        raw_response=detail,
    )


def _strip_markdown(text: str) -> str:
    """Remove markdown bold/italic markers (**text**, *text*, __text__)."""
    import re
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'_{1,2}(.*?)_{1,2}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    return text.strip()


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text.strip())


async def analyze_hand(parsed: ParsedHand, on_retry=None) -> AnalysisResult:
    if not os.getenv("DEEPSEEK_API_KEY"):
        return _error_result("API ключ DeepSeek не настроен")

    client = _get_client()

    async def _call(attempt):
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=4096,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_hand_message(parsed)},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        data = _parse_json_response(raw)
        s = _strip_markdown
        return AnalysisResult(
            preflop=s(data.get("preflop", "")),
            flop=s(data.get("flop", "")),
            turn=s(data.get("turn", "")),
            river=s(data.get("river", "")),
            main_leak=s(data.get("main_leak", "")),
            recommended_line=s(data.get("recommended_line", "")),
            ev_estimate=s(data.get("ev_estimate", "")),
            overall_score=data.get("overall_score"),
            raw_response=raw,
        )

    try:
        return await _with_retry(_call, on_retry=on_retry)
    except Exception as exc:
        logger.exception("analyze_hand failed: %s", exc)
        return _error_result(f"❌ Ошибка DeepSeek API: {str(exc)[:200]}", str(exc))


async def analyze_screenshot(
    image_bytes: bytes,
    experience_level: Optional[str] = None,
    play_style: Optional[str] = None,
    on_retry=None,
) -> AnalysisResult:
    """
    Two-step analysis:
    - Step 1: Claude (vision) extracts poker data from the image
    - Step 2: DeepSeek analyzes the extracted text data
    """
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")

    if not anthropic_key:
        return _error_result(
            "Для анализа скриншотов нужен Anthropic API ключ (распознавание изображений). "
            "Опишите раздачу текстом через /analyze."
        )
    if not deepseek_key:
        return _error_result("API ключ DeepSeek не настроен")

    import anthropic as _anthropic
    claude = _anthropic.AsyncAnthropic(api_key=anthropic_key)
    ds_client = _get_client()
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    async def _call(attempt):
        # Step 1: extract with Claude vision (cheap — 1024 tokens max)
        extract_response = await claude.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": SCREENSHOT_EXTRACT_PROMPT},
                ],
            }],
        )
        extracted_raw = next((b.text for b in extract_response.content if b.type == "text"), "{}")
        extracted = _parse_json_response(extracted_raw)

        screen_desc = (
            f"Данные со скриншота:\n"
            f"Тип игры: {extracted.get('game_type', 'NL Holdem')}\n"
            f"Ставки: {extracted.get('stakes', 'неизвестно')}\n"
            f"Карты Hero: {', '.join(extracted.get('hero_cards') or []) or 'не видно'}\n"
            f"Позиция Hero: {extracted.get('hero_position', 'неизвестно')}\n"
            f"Стек Hero: {extracted.get('stack_bb', 'неизвестно')} BB\n"
            f"Борд: {', '.join(extracted.get('board') or []) or 'нет (префлоп)'}\n"
            f"Улица: {extracted.get('street', 'неизвестно')}\n"
            f"Размер пота: {extracted.get('pot_size', 'неизвестно')}\n"
            f"Видимые действия: {extracted.get('actions_visible', 'нет данных')}\n"
            f"Оппоненты: {extracted.get('opponents', 'нет данных')}"
        )

        profile = _profile_context(experience_level, play_style)
        analysis_prompt = (
            f"Проанализируй покерную ситуацию:\n\n{screen_desc}{profile}\n\n"
            f"Верни JSON с полями: preflop, flop, turn, river, main_leak, recommended_line, ev_estimate, overall_score."
        )

        # Step 2: analyze with DeepSeek (cheap text model)
        analysis_response = await ds_client.chat.completions.create(
            model=MODEL,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": analysis_prompt},
            ],
        )
        analysis_raw = analysis_response.choices[0].message.content or "{}"
        data = _parse_json_response(analysis_raw)
        s = _strip_markdown
        return AnalysisResult(
            preflop=s(data.get("preflop", "")),
            flop=s(data.get("flop", "")),
            turn=s(data.get("turn", "")),
            river=s(data.get("river", "")),
            main_leak=s(data.get("main_leak", "")),
            recommended_line=s(data.get("recommended_line", "")),
            ev_estimate=s(data.get("ev_estimate", "")),
            overall_score=data.get("overall_score"),
            raw_response=analysis_raw,
        )

    try:
        return await _with_retry(_call, on_retry=on_retry)
    except Exception as exc:
        logger.exception("analyze_screenshot failed: %s", exc)
        return _error_result(f"❌ Ошибка анализа скриншота: {str(exc)[:200]}", str(exc))


async def ask_assistant(
    question: str,
    experience_level: Optional[str] = None,
    play_style: Optional[str] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> str:
    if not os.getenv("DEEPSEEK_API_KEY"):
        return "❌ API ключ DeepSeek не настроен."

    client = _get_client()
    system = ASSISTANT_SYSTEM_PROMPT + _profile_context(experience_level, play_style)

    messages: List[Dict] = [{"role": "system", "content": system}]
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": question})

    async def _call(attempt):
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=2048,
            messages=messages,
        )
        raw = response.choices[0].message.content or "Не удалось получить ответ."
        return _strip_markdown(raw)

    try:
        return await _with_retry(_call)
    except Exception as exc:
        logger.exception("ask_assistant failed: %s", exc)
        return f"❌ Ошибка DeepSeek API: {str(exc)[:200]}"


async def generate_lesson(
    topic: str,
    lesson_id: str,
    experience_level: Optional[str] = None,
    play_style: Optional[str] = None,
    on_retry=None,
) -> Optional[Dict]:
    if not os.getenv("DEEPSEEK_API_KEY"):
        return None

    client = _get_client()
    profile = _profile_context(experience_level, play_style)
    prompt = (
        f'Создай подробный урок по покеру на тему: "{topic}"\n\n'
        f"ID урока: {lesson_id}{profile}\n\n"
        f"Адаптируй сложность под уровень игрока. "
        f"Используй реальные ситуации, конкретные руки, позиции и числа."
    )

    async def _call(attempt):
        response = await client.chat.completions.create(
            model=MODEL,
            max_tokens=8000,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": LESSON_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        return _parse_json_response(raw)

    try:
        return await _with_retry(_call, on_retry=on_retry)
    except Exception as exc:
        logger.exception("generate_lesson failed topic=%r lesson_id=%r: %s", topic, lesson_id, exc)
        return None
