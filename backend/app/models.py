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
    image_url: Optional[str] = None


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
    image_url: Optional[str] = None


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
    recruiter_decision: Dict[str, Any] = Field(default_factory=dict)
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


class JobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    budget: str = Field(min_length=1, max_length=100)
    skill: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=1000)
    urgent: bool = False
    location: str = Field(default="", max_length=200)


class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    budget: str
    skill: str
    description: str = ""
    urgent: bool = False
    location: str = ""
    posted_at: str


class JobApplyRequest(BaseModel):
    worker_id: str
    passport_tier: Optional[str] = None
    karma_score: Optional[int] = None


class JobApplyResponse(BaseModel):
    application_id: str
    job_id: str
    worker_id: str
    status: str
    applied_at: str


class WorkerRatingRequest(BaseModel):
    worker_id: str
    rated_by: str = Field(..., min_length=2, max_length=120)
    rating: float = Field(..., ge=1.0, le=5.0)
    tags: List[str] = Field(default_factory=list)
    note: Optional[str] = Field(None, max_length=400)


class WorkerRatingResponse(BaseModel):
    rating_id: str
    worker_id: str
    job_id: str
    rating: float
    rated_by: str
    rated_at: str


class ReviewDecisionRequest(BaseModel):
    reviewer_id: str = Field(..., min_length=2, max_length=120)
    final_recommendation: Literal["pass", "hold", "reject"]
    rubric_edits: Dict[str, float] = Field(default_factory=dict)
    edit_notes: Dict[str, str] = Field(default_factory=dict)
    time_spent_seconds: Optional[int] = None


class ReviewDecisionResponse(BaseModel):
    decision_id: str
    session_id: str
    final_recommendation: str
    decided_at: str


class RubricPatchRequest(BaseModel):
    reviewer_id: str = Field(..., min_length=2, max_length=120)
    rubric_key: str
    new_score: float = Field(..., ge=0.0, le=100.0)
    note: str = Field(..., min_length=5, max_length=400)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"
