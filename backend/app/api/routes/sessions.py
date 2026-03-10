from fastapi import APIRouter, HTTPException

from app.agents.screening_logic import build_snapshot_feedback, choose_opening_question, finalize_session, run_agent_turn
from app.models import (
    CompleteResponse,
    IntegrityEvent,
    IntegrityEventRequest,
    IntegrityEventResponse,
    IntegrityLog,
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


def _recompute_integrity(log: IntegrityLog) -> IntegrityLog:
    if log.face_change_detected:
        return log.model_copy(update={"overall_flag": "critical_flag", "integrity_score": 0.2})
    if log.session_paused:
        return log.model_copy(update={"overall_flag": "requires_review", "integrity_score": 0.5})
    if log.multiface_events > 0 or log.gaze_deviation_events > 0 or log.face_absent_events > 0:
        return log.model_copy(update={"overall_flag": "minor_warning", "integrity_score": 0.85})
    return log.model_copy(update={"overall_flag": "clear", "integrity_score": 1.0})


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

    result = run_agent_turn(session, payload.worker_text)
    new_score = round(
        max(0.0, min(100.0, session.live_score + result["score_delta"])),
        2,
    )
    updated = session.model_copy(
        update={
            "transcript": [
                *session.transcript,
                TranscriptItem(
                    speaker="worker",
                    text=payload.worker_text.strip(),
                    timestamp=utc_now_iso(),
                    rubric_tag=payload.rubric_tag,
                    acoustic_confidence=payload.acoustic_confidence,
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
    sessions[session_id] = updated
    return TurnResponse(
        ai_question=result["ai_reply"],
        coach_note="",
        live_score=updated.live_score,
        rubric_tag=result["rubric_tag"],
        phase=result["phase"],
    )


@router.post("/sessions/{session_id}/snapshot", response_model=SnapshotResponse)
def add_snapshot_feedback(session_id: str, payload: SnapshotRequest) -> SnapshotResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    snapshot = build_snapshot_feedback(payload.note, session.live_score, payload.image_data)
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


@router.post("/sessions/{session_id}/integrity/event", response_model=IntegrityEventResponse)
def add_integrity_event(session_id: str, payload: IntegrityEventRequest) -> IntegrityEventResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    previous_log = session.integrity_log
    event_time = payload.timestamp or utc_now_iso()
    updates: dict = {"last_event_at": event_time}
    severity = "info"

    if payload.event == "multi_face_warning":
        updates["multiface_events"] = previous_log.multiface_events + 1
        updates["multiface_resolved"] = False
        severity = "warning"
    elif payload.event == "multi_face_resolved":
        updates["multiface_resolved"] = True
    elif payload.event == "multi_face_pause":
        updates["session_paused"] = True
        updates["pause_reason"] = "multiface"
        updates["multiface_resolved"] = False
        severity = "warning"
    elif payload.event == "face_absent":
        updates["face_absent_events"] = previous_log.face_absent_events + 1
        updates["session_paused"] = True
        updates["pause_reason"] = "face_absent"
        severity = "warning"
    elif payload.event == "gaze_away":
        updates["gaze_deviation_events"] = previous_log.gaze_deviation_events + 1
        severity = "warning"
    elif payload.event == "face_change":
        updates["face_change_detected"] = True
        updates["session_paused"] = True
        updates["pause_reason"] = "face_change"
        severity = "critical"
    elif payload.event == "resume":
        updates["session_paused"] = False
        updates["pause_reason"] = None
        if not previous_log.face_change_detected:
            updates["multiface_resolved"] = True

    next_log = _recompute_integrity(previous_log.model_copy(update=updates))
    next_event = IntegrityEvent(
        event=payload.event,
        severity=severity,
        timestamp=event_time,
        details=payload.details,
    )

    updated = session.model_copy(
        update={
            "integrity_log": next_log,
            "integrity_events": [*session.integrity_events, next_event][-200:],
        }
    )
    sessions[session_id] = updated
    return IntegrityEventResponse(
        integrity_log=next_log,
        session_paused=next_log.session_paused,
        pause_reason=next_log.pause_reason,
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
    return [s for s in sessions.values() if s.status == "live"]


@router.get("/sessions/reports", response_model=list[Session])
def completed_sessions() -> list[Session]:
    return [s for s in sessions.values() if s.status == "completed"]
