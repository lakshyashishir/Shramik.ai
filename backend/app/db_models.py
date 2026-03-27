from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, JSON, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkerDB(Base):
    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    specialization: Mapped[str] = mapped_column(String(120), nullable=False)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)


class SessionDB(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    worker_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    worker_name: Mapped[str] = mapped_column(String(80), nullable=False)
    assignment: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    domain_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    domain_detection_method: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="live")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    live_score: Mapped[float] = mapped_column(Float, default=0.0)
    recommendation: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    transcript: Mapped[dict] = mapped_column(JSON, default=list)
    snapshot_feedback: Mapped[dict] = mapped_column(JSON, default=list)
    rubric_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    integrity_log: Mapped[dict] = mapped_column(JSON, default=dict)
    integrity_events: Mapped[dict] = mapped_column(JSON, default=list)
    current_phase: Mapped[str] = mapped_column(String(50), default="intro")
    self_ratings: Mapped[dict] = mapped_column(JSON, default=dict)
    prior_work_media: Mapped[dict] = mapped_column(JSON, default=list)
    grounded_questions: Mapped[dict] = mapped_column(JSON, default=list)
    self_awareness_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    assessment_confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    phase0_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    phase0_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    portfolio_enrichment: Mapped[dict] = mapped_column(JSON, default=list)
    labor_pool_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    recruiter_decision: Mapped[dict] = mapped_column(JSON, default=dict)
    interview_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default="web")
    call_provider: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    call_phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    external_call_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    external_call_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    call_duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latest_call_recording_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
