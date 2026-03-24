from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, DateTime, JSON, Text
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


class SessionDB(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    worker_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    worker_name: Mapped[str] = mapped_column(String(80), nullable=False)
    assignment: Mapped[str] = mapped_column(Text, nullable=False)
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
