from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, JSON, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JobDB(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    budget: Mapped[str] = mapped_column(String(100), nullable=False)
    skill: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(200), default="")
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


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


class WorkerRatingDB(Base):
    __tablename__ = "worker_ratings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    worker_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(String(50), nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)          # 1.0 – 5.0
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # CSV e.g. "on_time,quality"
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rated_by: Mapped[str] = mapped_column(String(120), nullable=False)
    rated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class JobApplicationDB(Base):
    __tablename__ = "job_applications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    worker_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    passport_tier: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    karma_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="applied")   # applied | shortlisted | hired | rejected
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ReviewDecisionDB(Base):
    __tablename__ = "review_decisions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    reviewer_id: Mapped[str] = mapped_column(String(120), nullable=False)
    original_recommendation: Mapped[str] = mapped_column(String(20), nullable=False)
    final_recommendation: Mapped[str] = mapped_column(String(20), nullable=False)
    rubric_edits: Mapped[dict] = mapped_column(JSON, default=dict)
    edit_notes: Mapped[dict] = mapped_column(JSON, default=dict)
    time_spent_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
