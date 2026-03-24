"""
FastAPI routes for hand analysis and history.
"""
import json
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session, get_or_create_user, save_hand, get_user_hands
from core.parser import parse_hand
from core.ai_analyzer import analyze_hand
from models.schemas import (
    HandAnalysisRequest,
    HandAnalysisResponse,
    HandHistoryItem,
    ParsedHand,
    AnalysisResult,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["hands"])


@router.post("/analyze", response_model=HandAnalysisResponse)
async def analyze_hand_endpoint(
    request: HandAnalysisRequest,
    session: AsyncSession = Depends(get_session),
) -> HandAnalysisResponse:
    """Parse a hand and get AI analysis. Saves result to DB."""
    if not request.hand_text or not request.hand_text.strip():
        raise HTTPException(status_code=400, detail="hand_text не может быть пустым")

    # Ensure user exists
    user = await get_or_create_user(session, telegram_id=request.telegram_id)

    # Parse
    parsed: ParsedHand = parse_hand(request.hand_text)

    # AI analysis
    analysis: AnalysisResult = await analyze_hand(parsed)

    # Persist
    hand_record = await save_hand(
        session,
        user_id=user.id,
        hand_text=request.hand_text,
        parsed_data_json=parsed.model_dump_json(),
        analysis_json=analysis.model_dump_json(),
    )

    return HandAnalysisResponse(
        hand_id=hand_record.id,
        parsed_hand=parsed,
        analysis=analysis,
        created_at=hand_record.created_at,
    )


@router.get("/history/{telegram_id}", response_model=List[HandHistoryItem])
async def get_history(
    telegram_id: int,
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
) -> List[HandHistoryItem]:
    """Return last N analyzed hands for a user."""
    user = await get_or_create_user(session, telegram_id=telegram_id)
    hands = await get_user_hands(session, user_id=user.id, limit=min(limit, 20))

    result: List[HandHistoryItem] = []
    for hand in hands:
        analysis_summary = ""
        if hand.analysis:
            try:
                analysis_data = json.loads(hand.analysis)
                leak = analysis_data.get("main_leak", "")
                score = analysis_data.get("overall_score", "")
                parts = []
                if score:
                    parts.append(score)
                if leak:
                    parts.append(leak[:100])
                analysis_summary = " | ".join(parts)
            except Exception:
                pass

        result.append(HandHistoryItem(
            hand_id=hand.id,
            hand_text_preview=hand.hand_text[:150] + ("..." if len(hand.hand_text) > 150 else ""),
            analysis_summary=analysis_summary,
            created_at=hand.created_at,
        ))

    return result
