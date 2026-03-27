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
    phone_number: Optional[str] = None


class TranscriptItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    speaker: Literal["ai", "worker", "system"]
    text: str
    timestamp: str
    rubric_tag: Optional[str] = None
    acoustic_confidence: Optional[float] = None


class SnapshotFeedback(BaseModel):
    model_config = ConfigDict(extra="ignore")

    captured_at: str
    quality_score: float
    feedback: str
    focus_areas: List[str]
    note: str
    vision_confidence: Optional[float] = None


class PriorWorkItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    captured_at: str
    note: str
    vision_summary: str
    relevance_flag: Literal["relevant", "unclear", "irrelevant"] = "unclear"
    vision_confidence: Optional[float] = None


class PortfolioItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    captured_at: str
    note: str
    complexity: Literal["entry", "standard", "skilled", "complex"] = "standard"
    vision_summary: str


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
    domain: Optional[str] = None
    domain_confidence: Optional[float] = None
    domain_detection_method: Optional[str] = None
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
    current_phase: str = "intro"
    self_ratings: Dict[str, float] = Field(default_factory=dict)
    prior_work_media: List[PriorWorkItem] = Field(default_factory=list)
    grounded_questions: List[str] = Field(default_factory=list)
    self_awareness_profile: Dict[str, Any] = Field(default_factory=dict)
    assessment_confidence: Dict[str, Any] = Field(default_factory=dict)
    phase0_profile: Dict[str, Any] = Field(default_factory=dict)
    phase0_completed: bool = False
    portfolio_enrichment: List[PortfolioItem] = Field(default_factory=list)
    labor_pool_profile: Dict[str, Any] = Field(default_factory=dict)
    # Phone-call fields
    interview_mode: str = "web"
    call_provider: Optional[str] = None
    call_phone_number: Optional[str] = None
    external_call_id: Optional[str] = None
    external_call_status: Optional[str] = None
    call_duration_seconds: Optional[int] = None
    latest_call_recording_url: Optional[str] = None


class PriorWorkMediaRequest(BaseModel):
    images: List[str] = Field(min_length=1, max_length=3)
    note: str = Field(default="", max_length=280)


class PriorWorkMediaResponse(BaseModel):
    prior_work_media: List[PriorWorkItem]
    grounded_questions: List[str]


class SelfRatingsRequest(BaseModel):
    ratings: Dict[str, float]


class SelfRatingsResponse(BaseModel):
    self_ratings: Dict[str, float]


class PortfolioEnrichmentRequest(BaseModel):
    images: List[str] = Field(min_length=1, max_length=8)
    note: str = Field(default="", max_length=280)


class PortfolioEnrichmentResponse(BaseModel):
    portfolio_enrichment: List[PortfolioItem]


class SessionStartRequest(BaseModel):
    worker_id: str
    assignment: str = Field(min_length=8, max_length=400)


class SessionStartResponse(BaseModel):
    session: Session
    first_question: str


class TurnRequest(BaseModel):
    worker_text: str = Field(min_length=1, max_length=600)
    rubric_tag: Optional[str] = None
    acoustic_confidence: Optional[float] = None


class TurnResponse(BaseModel):
    ai_question: str
    coach_note: str
    live_score: float
    rubric_tag: Optional[str] = None
    phase: Optional[str] = None


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
