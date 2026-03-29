"""
Human-in-the-loop review queue.

GET  /review/queue                  — sessions pending manual review
POST /review/{session_id}/decision  — submit pass/hold/reject decision
PATCH /review/{session_id}/rubric   — adjust a single rubric score
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict, List, Optional

from app.database import get_db
from app.db_models import SessionDB, ReviewDecisionDB
from app.models import (
    ReviewDecisionRequest, ReviewDecisionResponse,
    RubricPatchRequest, new_id, utc_now_iso,
)
from app.services import store

router = APIRouter(tags=["review"])

# Sessions whose ML confidence falls below this threshold land in the review queue
_REVIEW_CONFIDENCE_THRESHOLD = 0.80


def _session_needs_review(db_session: SessionDB) -> bool:
    """
    A session enters the review queue when:
      - status is "completed"
      - ML confidence < threshold  (stored in assessment_confidence JSON)
      - OR integrity flag is "requires_review" / "critical_flag"
      - AND no final review decision has been recorded yet
    """
    if db_session.status != "completed":
        return False

    integrity = (db_session.integrity_log or {}).get("overall_flag", "clear")
    if integrity in ("requires_review", "critical_flag"):
        return True

    confidence = (db_session.assessment_confidence or {}).get("overall", 1.0)
    return float(confidence) < _REVIEW_CONFIDENCE_THRESHOLD


@router.get("/review/queue")
async def get_review_queue(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Return completed sessions that need human review, ordered by integrity severity
    then by lowest confidence first.
    """
    result = await db.execute(
        select(SessionDB).where(SessionDB.status == "completed")
    )
    all_completed = result.scalars().all()

    # Filter to sessions without a review decision
    reviewed_ids_result = await db.execute(select(ReviewDecisionDB.session_id))
    reviewed_ids = {row[0] for row in reviewed_ids_result.all()}

    queue = []
    for s in all_completed:
        if s.id in reviewed_ids:
            continue
        if not _session_needs_review(s):
            continue
        integrity = (s.integrity_log or {}).get("overall_flag", "clear")
        confidence = float((s.assessment_confidence or {}).get("overall", 1.0))
        queue.append({
            "session_id": s.id,
            "worker_id": s.worker_id,
            "worker_name": s.worker_name,
            "domain": s.domain,
            "live_score": round(s.live_score),
            "recommendation": s.recommendation,
            "integrity_flag": integrity,
            "confidence": round(confidence, 3),
            "interview_mode": s.interview_mode or "web",
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "rubric_scores": {
                k: v for k, v in (s.rubric_scores or {}).items()
                if k != "integrity_compliance"
            },
        })

    # Sort: critical_flag first, then by ascending confidence
    severity_order = {"critical_flag": 0, "requires_review": 1, "minor_warning": 2, "clear": 3}
    queue.sort(key=lambda x: (severity_order.get(x["integrity_flag"], 3), x["confidence"]))
    return queue


@router.post("/review/{session_id}/decision", response_model=ReviewDecisionResponse, status_code=201)
async def submit_review_decision(
    session_id: str,
    payload: ReviewDecisionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reviewer submits a final pass/hold/reject decision, optionally with rubric edits.
    Rubric edits are written back to the session record.
    """
    result = await db.execute(select(SessionDB).where(SessionDB.id == session_id))
    db_session = result.scalar_one_or_none()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Apply rubric edits to the session
    if payload.rubric_edits:
        updated_rubric = dict(db_session.rubric_scores or {})
        updated_rubric.update(payload.rubric_edits)
        db_session.rubric_scores = updated_rubric

    # Store decision
    decision = ReviewDecisionDB(
        id=new_id("rev"),
        session_id=session_id,
        reviewer_id=payload.reviewer_id,
        original_recommendation=db_session.recommendation,
        final_recommendation=payload.final_recommendation,
        rubric_edits=payload.rubric_edits,
        edit_notes=payload.edit_notes,
        time_spent_seconds=payload.time_spent_seconds,
    )
    db.add(decision)
    await db.commit()
    await db.refresh(decision)

    return ReviewDecisionResponse(
        decision_id=decision.id,
        session_id=session_id,
        final_recommendation=payload.final_recommendation,
        decided_at=decision.decided_at.isoformat(),
    )


@router.patch("/review/{session_id}/rubric")
async def patch_rubric_score(
    session_id: str,
    payload: RubricPatchRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Adjust a single rubric dimension score with a mandatory reviewer note.
    Updates the session rubric in-place.
    """
    result = await db.execute(select(SessionDB).where(SessionDB.id == session_id))
    db_session = result.scalar_one_or_none()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    updated = dict(db_session.rubric_scores or {})
    old_score = updated.get(payload.rubric_key)
    updated[payload.rubric_key] = payload.new_score
    db_session.rubric_scores = updated
    await db.commit()

    return {
        "session_id": session_id,
        "rubric_key": payload.rubric_key,
        "old_score": old_score,
        "new_score": payload.new_score,
        "reviewer_id": payload.reviewer_id,
        "note": payload.note,
        "updated_at": utc_now_iso(),
    }
