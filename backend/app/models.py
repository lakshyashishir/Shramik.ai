from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class WorkerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    specialization: str = Field(min_length=2, max_length=120)
    experience_years: int = Field(ge=0, le=50)


class Worker(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    specialization: str
    experience_years: int
    created_at: str


class TranscriptItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    speaker: Literal["ai", "worker", "system"]
    text: str
    timestamp: str


class SnapshotFeedback(BaseModel):
    model_config = ConfigDict(extra="ignore")

    captured_at: str
    quality_score: float
    feedback: str
    focus_areas: List[str]
    note: str


class Session(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    worker_id: str
    worker_name: str
    assignment: str
    status: Literal["live", "completed"]
    started_at: str
    ended_at: Optional[str] = None
    live_score: float
    recommendation: str
    summary: str
    transcript: List[TranscriptItem]
    snapshot_feedback: List[SnapshotFeedback]
    rubric_scores: Dict[str, float]


class SessionStartRequest(BaseModel):
    worker_id: str
    assignment: str = Field(min_length=8, max_length=400)


class SessionStartResponse(BaseModel):
    session: Session
    first_question: str


class TurnRequest(BaseModel):
    worker_text: str = Field(min_length=1, max_length=600)


class TurnResponse(BaseModel):
    ai_question: str
    coach_note: str
    live_score: float


class SnapshotRequest(BaseModel):
    image_data: str = Field(min_length=30)
    note: str = Field(default="", max_length=240)


class SnapshotResponse(BaseModel):
    quality_score: float
    feedback: str
    focus_areas: List[str]
    snapshot_count: int
    live_score: float


class CompleteResponse(BaseModel):
    session: Session


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"
