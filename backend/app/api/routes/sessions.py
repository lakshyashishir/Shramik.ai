from fastapi import APIRouter, HTTPException

from app.agents.screening_logic import build_snapshot_feedback, choose_opening_question, finalize_session, next_turn
from app.models import (
    CompleteResponse,
    Session,
    SessionStartRequest,
    SessionStartResponse,
    SnapshotRequest,
    SnapshotResponse,
    TranscriptItem,
    TurnRequest,
    TurnResponse,
    new_id,
    utc_now_iso,
)
from app.services.store import sessions, workers

router = APIRouter(tags=["sessions"])


@router.post("/sessions/start", response_model=SessionStartResponse)
def start_session(payload: SessionStartRequest) -> SessionStartResponse:
    worker = workers.get(payload.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    first_question = choose_opening_question(worker.name, payload.assignment)
    session = Session(
        id=new_id("session"),
        worker_id=worker.id,
        worker_name=worker.name,
        assignment=payload.assignment.strip(),
        status="live",
        started_at=utc_now_iso(),
        live_score=50.0,
        recommendation="pending",
        summary="Session in progress",
        transcript=[
            TranscriptItem(speaker="ai", text=first_question, timestamp=utc_now_iso())
        ],
        snapshot_feedback=[],
        rubric_scores={},
    )
    sessions[session.id] = session
    return SessionStartResponse(session=session, first_question=first_question)


@router.post("/sessions/{session_id}/turn", response_model=TurnResponse)
def session_turn(session_id: str, payload: TurnRequest) -> TurnResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    turn_index = sum(1 for item in session.transcript if item.speaker == "worker")
    ai_question, coach_note, delta = next_turn(turn_index)
    updated = session.model_copy(
        update={
            "transcript": [
                *session.transcript,
                TranscriptItem(speaker="worker", text=payload.worker_text.strip(), timestamp=utc_now_iso()),
                TranscriptItem(speaker="ai", text=ai_question, timestamp=utc_now_iso()),
            ],
            "live_score": min(100.0, round(session.live_score + delta, 2)),
        }
    )
    sessions[session_id] = updated
    return TurnResponse(ai_question=ai_question, coach_note=coach_note, live_score=updated.live_score)


@router.post("/sessions/{session_id}/snapshot", response_model=SnapshotResponse)
def add_snapshot_feedback(session_id: str, payload: SnapshotRequest) -> SnapshotResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    snapshot = build_snapshot_feedback(payload.note, session.live_score)
    updated = session.model_copy(
        update={
            "snapshot_feedback": [*session.snapshot_feedback, snapshot],
            "live_score": round((session.live_score * 0.85) + (snapshot.quality_score * 0.15), 2),
        }
    )
    sessions[session_id] = updated

    return SnapshotResponse(
        quality_score=snapshot.quality_score,
        feedback=snapshot.feedback,
        focus_areas=snapshot.focus_areas,
        snapshot_count=len(updated.snapshot_feedback),
        live_score=updated.live_score,
    )


@router.post("/sessions/{session_id}/complete", response_model=CompleteResponse)
def complete_session(session_id: str) -> CompleteResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        return CompleteResponse(session=session)

    completed = finalize_session(session)
    sessions[session_id] = completed
    return CompleteResponse(session=completed)


@router.get("/session/{session_id}", response_model=Session)
def get_session(session_id: str) -> Session:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/live", response_model=list[Session])
def live_sessions() -> list[Session]:
    return [session for session in sessions.values() if session.status == "live"]


@router.get("/sessions/reports", response_model=list[Session])
def completed_sessions() -> list[Session]:
    return [session for session in sessions.values() if session.status == "completed"]
