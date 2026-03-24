from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ActionItem(BaseModel):
    position: str
    action: str
    size_bb: Optional[float] = None
    street: str = "preflop"


class ParsedHand(BaseModel):
    game_type: str = "NL Holdem"
    stakes: Optional[str] = None
    hero_cards: Optional[List[str]] = None
    hero_position: Optional[str] = None
    stack_bb: Optional[float] = None
    board: Optional[List[str]] = None
    flop: Optional[List[str]] = None
    turn: Optional[str] = None
    river: Optional[str] = None
    actions: List[ActionItem] = Field(default_factory=list)
    pot_bb: Optional[float] = None
    raw_text: str = ""
    parse_error: Optional[str] = None


class AnalysisResult(BaseModel):
    preflop: str = ""
    flop: str = ""
    turn: str = ""
    river: str = ""
    main_leak: str = ""
    recommended_line: str = ""
    ev_estimate: str = ""
    overall_score: Optional[str] = None
    raw_response: str = ""


class HandAnalysisRequest(BaseModel):
    telegram_id: int
    hand_text: str


class HandAnalysisResponse(BaseModel):
    hand_id: int
    parsed_hand: ParsedHand
    analysis: AnalysisResult
    created_at: datetime


class HandHistoryItem(BaseModel):
    hand_id: int
    hand_text_preview: str
    analysis_summary: str
    created_at: datetime


class UserCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    telegram_id: int
    first_name: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    experience_level: Optional[str] = None
    play_style: Optional[str] = None
    hands_analyzed_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrainingProgress(BaseModel):
    id: int
    user_id: int
    lesson_id: str
    completed_at: datetime

    model_config = {"from_attributes": True}
