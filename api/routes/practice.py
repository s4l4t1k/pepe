"""
Practice module — AI poker scenarios + quiz.
Client generates scenarios; AI evaluates actions and generates quiz questions.
"""
import json
import logging
import os
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI

from api.routes.auth import get_current_web_user

router = APIRouter(prefix="/api/web/practice", tags=["practice"])
logger = logging.getLogger(__name__)


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com",
    )


def _parse_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown code blocks
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        # Try to extract {...}
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


TRAINER_PERSONA = (
    "Ты — Виктор, профессиональный тренер по покеру с 18-летним опытом. "
    "Говоришь только по-русски. Прямой, конкретный, без воды."
)


# ── Evaluate player action ─────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    position: str
    stack: float
    pot: float
    hole_cards: List[str]   # e.g. ["Ah", "Kd"]
    board: List[str]        # e.g. ["Jh", "Th", "2s"]
    street: str
    villain_action: str     # "чек" or "бет Xbb"
    player_action: str      # fold / check / call / bet_third / bet_half / bet_pot / allin / raise


@router.post("/evaluate")
async def evaluate_action(
    req: EvaluateRequest,
    current_user=Depends(get_current_web_user),
):
    hole = " ".join(req.hole_cards)
    board = " ".join(req.board) if req.board else "нет (префлоп)"

    prompt = f"""{TRAINER_PERSONA}

Оцени действие игрока в NL Hold'em кэше. Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{{
  "grade": "excellent" | "good" | "ok" | "mistake" | "big_mistake",
  "correct": true или false,
  "title": "3-5 слов итог",
  "explanation": "2-3 предложения — почему это хорошо или плохо, с конкретными цифрами",
  "optimal": "Что было бы оптимально и почему"
}}

Ситуация:
- Позиция: {req.position}
- Стек: {req.stack}bb, Пот: {req.pot}bb
- Улица: {req.street}
- Карты игрока: {hole}
- Борд: {board}
- Действие оппонента: {req.villain_action}
- Действие игрока: {req.player_action}"""

    try:
        client = _get_client()
        resp = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=400,
        )
        raw = resp.choices[0].message.content or "{}"
        data = _parse_json(raw)
        if not data:
            raise ValueError("empty parse")
        return data
    except Exception as e:
        logger.error(f"Practice evaluate error: {e}")
        return {
            "grade": "ok",
            "correct": True,
            "title": "Действие засчитано",
            "explanation": "AI временно недоступен. Попробуй снова через несколько секунд.",
            "optimal": "",
        }


# ── Generate quiz question ─────────────────────────────────────────────────────

@router.post("/quiz")
async def get_quiz(current_user=Depends(get_current_web_user)):
    prompt = f"""{TRAINER_PERSONA}

Создай ОДИН интересный квиз-вопрос по NL Hold'em кэшу (100bb стек).
Сценарий должен быть неочевидным — не тривиальным фолдом или очевидным колом.
Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{{
  "hole_cards": ["Ah", "Kd"],
  "board": ["Jh", "Th", "2s"],
  "position": "BTN",
  "stack": 87,
  "pot": 15,
  "villain_action": "бет 10bb",
  "situation": "Краткое описание ситуации по-русски (1-2 предложения)",
  "options": [
    {{"label": "Фолд", "action": "fold"}},
    {{"label": "Колл", "action": "call"}},
    {{"label": "Рейз до 28bb", "action": "raise"}},
    {{"label": "Олл-ин", "action": "allin"}}
  ],
  "correct": 2,
  "explanation": "Детальное объяснение 3-4 предложения с конкретными цифрами"
}}

Правила:
- board может быть флоп (3), тёрн (4) или ривер (5) карт
- options — ровно 4 варианта, реалистичных для данной ситуации
- correct — индекс (0-3) правильного варианта
- Используй реальные покерные концепции (equity, блок-беты, поляризация и т.д.)"""

    try:
        client = _get_client()
        resp = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content or "{}"
        data = _parse_json(raw)
        if not data or "hole_cards" not in data:
            raise ValueError("invalid quiz")
        return data
    except Exception as e:
        logger.error(f"Practice quiz error: {e}")
        # Fallback hardcoded quiz
        return {
            "hole_cards": ["Ah", "Kh"],
            "board": ["Jh", "Th", "2s"],
            "position": "BTN",
            "stack": 87,
            "pot": 15,
            "villain_action": "бет 10bb",
            "situation": "БТН против ББ на флопе J♥T♥2♠. У тебя A♥K♥ — флеш-дро + оверкарты. Оппонент ставит бет 10bb в пот 15bb.",
            "options": [
                {"label": "Фолд", "action": "fold"},
                {"label": "Колл", "action": "call"},
                {"label": "Рейз до 28bb", "action": "raise"},
                {"label": "Олл-ин", "action": "allin"},
            ],
            "correct": 2,
            "explanation": "Рейз — лучшее действие. У тебя флеш-дро + 2 оверкарты = ~15 аутов (~60% equity до ривера). Рейз создаёт fold equity и строит пот когда ты в позиции. Колл тоже допустим, но рейз более агрессивен и выгоден с такой силой руки.",
        }
