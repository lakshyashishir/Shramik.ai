from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
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


class IntegrityEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event: Literal[
        "multi_face_warning",
        "multi_face_resolved",
        "multi_face_pause",
        "face_absent",
        "gaze_away",
        "face_change",
        "resume",
    ]
    severity: Literal["info", "warning", "critical"]
    source: Literal["mediapipe"] = "mediapipe"
    timestamp: str
    details: Dict[str, Any] = Field(default_factory=dict)


class IntegrityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")

    multiface_events: int = 0
    multiface_resolved: bool = True
    face_absent_events: int = 0
    gaze_deviation_events: int = 0
    face_change_detected: bool = False
    session_paused: bool = False
    pause_reason: Optional[Literal["multiface", "face_absent", "face_change"]] = None
    overall_flag: Literal["clear", "minor_warning", "requires_review", "critical_flag"] = "clear"
    integrity_score: float = 1.0
    last_event_at: Optional[str] = None


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
    integrity_log: IntegrityLog = Field(default_factory=IntegrityLog)
    integrity_events: List[IntegrityEvent] = Field(default_factory=list)


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


class IntegrityEventRequest(BaseModel):
    event: Literal[
        "multi_face_warning",
        "multi_face_resolved",
        "multi_face_pause",
        "face_absent",
        "gaze_away",
        "face_change",
        "resume",
    ]
    timestamp: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class IntegrityEventResponse(BaseModel):
    integrity_log: IntegrityLog
    session_paused: bool
    pause_reason: Optional[Literal["multiface", "face_absent", "face_change"]] = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"
