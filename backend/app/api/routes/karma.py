"""
Karma API routes.

GET  /api/workers/{worker_id}/karma   — compute + return karma score for a worker
GET  /api/passport/{worker_id}        — public passport (karma, rubrics, narrative, tier)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict, List, Optional

from app.database import get_db
from app.services import store
from app.db_models import SessionDB
from app.agents.karma_engine import compute_karma

router = APIRouter(tags=["karma"])


class KarmaResponse(BaseModel):
    worker_id: str
    karma: int
    tier: str
    skill_score: float
    integrity_score: float
    components: Dict[str, int]
    session_id: Optional[str] = None
    interview_mode: Optional[str] = None


class PassportResponse(BaseModel):
    worker_id: str
    worker_name: str
    specialization: str
    experience_years: int
    karma: int
    tier: str
    skill_score: float
    integrity_score: float
    rubric_scores: Dict[str, float]
    summary: str
    recommendation: str
    integrity_flag: str
    channel: str
    components: Dict[str, int]
    # Extended profile fields
    sessions_completed: int
    best_score: float
    all_scores: List[int]
    portfolio_snapshots: List[Dict[str, Any]]  # {captured_at, feedback, quality_score}
    portfolio_enrichment: List[Dict[str, Any]]  # {note, vision_summary, complexity}
    prior_work: List[Dict[str, Any]]            # {note, vision_summary, relevance_flag}
    session_history: List[Dict[str, Any]]       # lightweight session list


async def _get_worker_sessions(db: AsyncSession, worker_id: str):
    result = await db.execute(
        select(SessionDB).where(SessionDB.worker_id == worker_id)
    )
    return result.scalars().all()


@router.get("/workers/{worker_id}/karma", response_model=KarmaResponse)
async def get_worker_karma(worker_id: str, db: AsyncSession = Depends(get_db)):
    worker = await store.get_worker(db, worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Load sessions as full model objects via the store helper
    db_sessions = await _get_worker_sessions(db, worker_id)
    sessions = [store._db_session_to_model(s) for s in db_sessions]

    result = compute_karma(sessions)
    return KarmaResponse(worker_id=worker_id, **result)


@router.get("/passport/{worker_id}", response_model=PassportResponse)
async def get_passport(worker_id: str, db: AsyncSession = Depends(get_db)):
    worker = await store.get_worker(db, worker_id)
    if worker is None:
        raise HTTPException(status_code=404, detail="Worker not found")

    db_sessions = await _get_worker_sessions(db, worker_id)
    sessions = [store._db_session_to_model(s) for s in db_sessions]

    karma_data = compute_karma(sessions)

    # Best completed session for rubric / narrative
    completed = [s for s in sessions if s.status == "completed"]
    best = max(completed, key=lambda s: s.live_score) if completed else None

    rubric_scores: Dict[str, float] = best.rubric_scores if best else {}
    # Strip internal key
    rubric_scores = {k: v for k, v in rubric_scores.items() if k != "integrity_compliance"}

    # Build session history (lightweight)
    session_history = [
        {
            "id": s.id,
            "status": s.status,
            "score": round(s.live_score),
            "recommendation": s.recommendation,
            "channel": s.interview_mode or "web",
            "ended_at": s.ended_at,
        }
        for s in sorted(completed, key=lambda x: x.live_score, reverse=True)
    ]

    # Collect portfolio snapshots from all completed sessions
    portfolio_snapshots = []
    portfolio_enrichment = []
    prior_work = []
    for s in completed:
        for snap in (s.snapshot_feedback or []):
            portfolio_snapshots.append({
                "captured_at": snap.captured_at,
                "feedback": snap.feedback,
                "quality_score": snap.quality_score,
                "focus_areas": snap.focus_areas,
                "image_url": snap.image_url,
            })
        for item in (s.portfolio_enrichment or []):
            portfolio_enrichment.append({
                "note": item.note,
                "vision_summary": item.vision_summary,
                "complexity": item.complexity,
                "captured_at": item.captured_at,
                "image_url": getattr(item, "image_url", None),
            })
        for item in (s.prior_work_media or []):
            prior_work.append({
                "note": item.note,
                "vision_summary": item.vision_summary,
                "relevance_flag": item.relevance_flag,
            })

    all_scores = [round(s.live_score) for s in completed]

    return PassportResponse(
        worker_id=worker_id,
        worker_name=worker.name,
        specialization=worker.specialization,
        experience_years=worker.experience_years,
        karma=karma_data["karma"],
        tier=karma_data["tier"],
        skill_score=karma_data["skill_score"],
        integrity_score=karma_data["integrity_score"],
        rubric_scores=rubric_scores,
        summary=best.summary if best else "",
        recommendation=best.recommendation if best else "pending",
        integrity_flag=best.integrity_log.overall_flag if best else "clear",
        channel=best.interview_mode if best else "web",
        components=karma_data["components"],
        sessions_completed=len(completed),
        best_score=round(best.live_score) if best else 0,
        all_scores=all_scores,
        portfolio_snapshots=portfolio_snapshots,
        portfolio_enrichment=portfolio_enrichment,
        prior_work=prior_work,
        session_history=session_history,
    )
