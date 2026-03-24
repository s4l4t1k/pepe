"""
Web app feature endpoints — all require JWT auth.
"""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    get_session,
    save_web_hand,
    get_web_user_hands,
    get_web_completed_lessons,
    mark_web_lesson_complete,
    get_web_user_stats,
)
from core.parser import parse_hand
from core.ai_analyzer import analyze_hand, analyze_screenshot, ask_assistant, generate_lesson
from api.routes.auth import get_current_web_user
from bot.keyboards import MODULES, LESSONS, LESSON_TOPICS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/web", tags=["web"])


# ── Request/Response Schemas ──────────────────────────────────────────────────

class AnalyzeHandRequest(BaseModel):
    hand_text: str


class AssistantRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = None


class AssistantResponse(BaseModel):
    answer: str


class LessonItem(BaseModel):
    lesson_id: str
    lesson_name: str
    completed: bool


class ModuleItem(BaseModel):
    module_id: str
    module_name: str
    lessons: List[LessonItem]
    completed_count: int
    total_count: int


class HandHistoryItem(BaseModel):
    hand_id: int
    hand_text_preview: str
    analysis: Optional[dict]
    created_at: str


class ProfileResponse(BaseModel):
    id: int
    email: str
    first_name: str
    experience_level: Optional[str]
    play_style: Optional[str]
    hands_analyzed_count: int
    lessons_completed_count: int
    created_at: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _analysis_to_dict(analysis_json: Optional[str]) -> Optional[dict]:
    if not analysis_json:
        return None
    try:
        return json.loads(analysis_json)
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze/hand")
async def analyze_hand_endpoint(
    req: AnalyzeHandRequest,
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
):
    """Analyze a poker hand text."""
    if not req.hand_text or not req.hand_text.strip():
        raise HTTPException(status_code=400, detail="hand_text не может быть пустым")

    parsed = parse_hand(req.hand_text)
    analysis = await analyze_hand(parsed)

    hand_record = await save_web_hand(
        session,
        web_user_id=current_user.id,
        hand_text=req.hand_text,
        parsed_data_json=parsed.model_dump_json(),
        analysis_json=analysis.model_dump_json(),
    )

    return {
        "hand_id": hand_record.id,
        "parsed_hand": parsed.model_dump(),
        "analysis": analysis.model_dump(),
        "created_at": hand_record.created_at.isoformat(),
    }


@router.post("/analyze/screenshot")
async def analyze_screenshot_endpoint(
    file: UploadFile = File(...),
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
):
    """Analyze a poker screenshot image."""
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Поддерживаются только изображения (JPEG, PNG, WebP, GIF)")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 10 МБ)")

    analysis = await analyze_screenshot(
        image_bytes,
        experience_level=current_user.experience_level,
        play_style=current_user.play_style,
    )

    hand_record = await save_web_hand(
        session,
        web_user_id=current_user.id,
        hand_text=f"[Screenshot: {file.filename}]",
        parsed_data_json="{}",
        analysis_json=analysis.model_dump_json(),
    )

    return {
        "hand_id": hand_record.id,
        "analysis": analysis.model_dump(),
        "created_at": hand_record.created_at.isoformat(),
    }


@router.post("/assistant", response_model=AssistantResponse)
async def assistant_endpoint(
    req: AssistantRequest,
    current_user=Depends(get_current_web_user),
) -> AssistantResponse:
    """Get an answer from the AI poker assistant."""
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Вопрос не может быть пустым")

    answer = await ask_assistant(
        question=req.question,
        experience_level=current_user.experience_level,
        play_style=current_user.play_style,
        conversation_history=req.history,
    )
    return AssistantResponse(answer=answer)


@router.get("/training/modules", response_model=List[ModuleItem])
async def get_training_modules(
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
) -> List[ModuleItem]:
    """Return all training modules with lessons and completion status."""
    completed_ids = await get_web_completed_lessons(session, current_user.id)
    completed_set = set(completed_ids)

    modules = []
    for module_name, module_id in MODULES:
        lessons_raw = LESSONS.get(module_id, [])
        lesson_items = []
        for lesson_name, lesson_id in lessons_raw:
            lesson_items.append(LessonItem(
                lesson_id=lesson_id,
                lesson_name=lesson_name,
                completed=(lesson_id in completed_set),
            ))
        modules.append(ModuleItem(
            module_id=module_id,
            module_name=module_name,
            lessons=lesson_items,
            completed_count=sum(1 for l in lesson_items if l.completed),
            total_count=len(lesson_items),
        ))

    return modules


@router.post("/training/lesson/{lesson_id}")
async def get_lesson_content(
    lesson_id: str,
    current_user=Depends(get_current_web_user),
):
    """Generate and return lesson content."""
    topic = LESSON_TOPICS.get(lesson_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Урок не найден")

    content = await generate_lesson(
        topic=topic,
        lesson_id=lesson_id,
        experience_level=current_user.experience_level,
        play_style=current_user.play_style,
    )

    if content is None:
        raise HTTPException(status_code=503, detail="Не удалось загрузить урок. Попробуйте позже.")

    return {"lesson_id": lesson_id, "topic": topic, "content": content}


@router.post("/training/complete/{lesson_id}")
async def complete_lesson(
    lesson_id: str,
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
):
    """Mark a lesson as completed."""
    if lesson_id not in LESSON_TOPICS:
        raise HTTPException(status_code=404, detail="Урок не найден")

    progress = await mark_web_lesson_complete(session, current_user.id, lesson_id)
    return {
        "lesson_id": lesson_id,
        "completed": True,
        "completed_at": progress.completed_at.isoformat(),
    }


@router.get("/history", response_model=List[HandHistoryItem])
async def get_history(
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
) -> List[HandHistoryItem]:
    """Return last 20 analyzed hands for the current user."""
    hands = await get_web_user_hands(session, current_user.id, limit=20)

    result = []
    for hand in hands:
        result.append(HandHistoryItem(
            hand_id=hand.id,
            hand_text_preview=hand.hand_text[:200] + ("..." if len(hand.hand_text) > 200 else ""),
            analysis=_analysis_to_dict(hand.analysis),
            created_at=hand.created_at.isoformat(),
        ))

    return result


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user=Depends(get_current_web_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileResponse:
    """Return user stats and profile info."""
    stats = await get_web_user_stats(session, current_user.id)

    return ProfileResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        experience_level=current_user.experience_level,
        play_style=current_user.play_style,
        hands_analyzed_count=stats["hands_count"],
        lessons_completed_count=stats["lessons_count"],
        created_at=current_user.created_at.isoformat(),
    )
