# Legacy module — kept for test compatibility only.
# Production code uses app.services.store (PostgreSQL) directly.

from fastapi import HTTPException

from app.agents.screening_logic import choose_opening_question, finalize_session, run_agent_turn
from app.models import (
    Session,
    TranscriptItem,
    TurnResponse,
    Worker,
    new_id,
    utc_now_iso,
)

# Fallback in-memory store used only by legacy tests
_sessions: dict[str, Session] = {}


def create_session(
    worker: Worker,
    assignment: str,
    *,
    interview_mode: str = "web",
    locale: str = "en",
    call_provider: str | None = None,
    call_phone_number: str | None = None,
    external_call_id: str | None = None,
    external_call_status: str | None = None,
) -> tuple[Session, str]:
    first_question = choose_opening_question(worker.name, assignment, locale)
    session = Session(
        id=new_id("session"),
        worker_id=worker.id,
        worker_name=worker.name,
        assignment=assignment.strip(),
        status="live",
        started_at=utc_now_iso(),
        live_score=50.0,
        recommendation="pending",
        summary="Session in progress",
        transcript=[TranscriptItem(speaker="ai", text=first_question, timestamp=utc_now_iso())],
        snapshot_feedback=[],
        rubric_scores={},
        interview_mode=interview_mode,
        call_provider=call_provider,
        call_phone_number=call_phone_number,
        external_call_id=external_call_id,
        external_call_status=external_call_status,
    )
    _sessions[session.id] = session
    return session, first_question


def require_session(session_id: str) -> Session:
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def append_turn(
    session_id: str,
    worker_text: str,
    *,
    locale: str = "en",
    rubric_tag: str | None = None,
    acoustic_confidence: float | None = None,
) -> tuple[Session, TurnResponse]:
    session = require_session(session_id)
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    result = run_agent_turn(session, worker_text, locale)
    new_score = round(max(0.0, min(100.0, session.live_score + result["score_delta"])), 2)
    updated = session.model_copy(
        update={
            "transcript": [
                *session.transcript,
                TranscriptItem(
                    speaker="worker",
                    text=worker_text.strip(),
                    timestamp=utc_now_iso(),
                    rubric_tag=rubric_tag,
                    acoustic_confidence=acoustic_confidence,
                ),
                TranscriptItem(
                    speaker="ai",
                    text=result["ai_reply"],
                    timestamp=utc_now_iso(),
                    rubric_tag=result["rubric_tag"],
                ),
            ],
            "current_phase": result["phase"],
            "live_score": new_score,
        }
    )
    _sessions[session_id] = updated
    return updated, TurnResponse(
        ai_question=result["ai_reply"],
        coach_note="",
        live_score=updated.live_score,
        rubric_tag=result["rubric_tag"],
        phase=result["phase"],
    )


def complete_session(session_id: str, *, locale: str = "en") -> Session:
    session = require_session(session_id)
    if session.status == "completed":
        return session
    completed = finalize_session(session, locale)
    _sessions[session_id] = completed
    return completed


def update_session(session_id: str, **updates: object) -> Session:
    session = require_session(session_id)
    updated = session.model_copy(update=updates)
    _sessions[session_id] = updated
    return updated
