from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.screening_logic import (
    build_default_self_ratings,
    build_portfolio_enrichment,
    build_prior_work_media,
    build_snapshot_feedback,
    classify_trade_with_confidence,
    choose_opening_question,
    finalize_session,
    init_phase0_profile,
    phase0_missing_fields,
    process_phase0_turn,
    run_agent_turn,
)
from app.database import get_db
from app.models import (
    CompleteResponse,
    IntegrityEvent,
    IntegrityEventRequest,
    IntegrityEventResponse,
    IntegrityLog,
    PortfolioEnrichmentRequest,
    PortfolioEnrichmentResponse,
    PortfolioItem,
    PriorWorkItem,
    PriorWorkMediaRequest,
    PriorWorkMediaResponse,
    SelfRatingsRequest,
    SelfRatingsResponse,
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
from app.services import store

router = APIRouter(tags=["sessions"])
ASSIGNMENT_TEMPLATES = {
    "garment_worker": "Stitch a clean straight seam with consistent margin and explain your quality checks.",
    "beauty_professional": "Show a recent beauty service output (hair/mehendi/nail) and explain your process steps.",
    "carpenter": "Make a simple joint on scrap wood (butt/half-lap) and explain your tool and marking process.",
    "electrician": "Draw a simple 2-way switch circuit for one lamp with L/N/E and explain the logic.",
    "domain_unknown": "Complete registration questions about your work preferences and availability.",
}
DEFAULT_ASSIGNMENT = ASSIGNMENT_TEMPLATES["garment_worker"]


def _recompute_integrity(log: IntegrityLog) -> IntegrityLog:
    if log.face_change_detected:
        return log.model_copy(update={"overall_flag": "critical_flag", "integrity_score": 0.2})
    if log.session_paused:
        return log.model_copy(update={"overall_flag": "requires_review", "integrity_score": 0.5})
    if log.multiface_events > 0 or log.gaze_deviation_events > 0 or log.face_absent_events > 0:
        return log.model_copy(update={"overall_flag": "minor_warning", "integrity_score": 0.85})
    return log.model_copy(update={"overall_flag": "clear", "integrity_score": 1.0})


@router.post("/sessions/start", response_model=SessionStartResponse)
async def start_session(
    payload: SessionStartRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> SessionStartResponse:
    worker = await store.get_worker(db, payload.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    domain, domain_confidence, detection_method = classify_trade_with_confidence(
        worker.specialization,
        payload.assignment,
    )
    assignment = payload.assignment.strip()
    if not assignment or assignment.lower() == DEFAULT_ASSIGNMENT.lower():
        assignment = ASSIGNMENT_TEMPLATES.get(domain, DEFAULT_ASSIGNMENT)

    first_question = choose_opening_question(worker.name, assignment, locale, domain)
    phase0_profile = init_phase0_profile(worker.name, worker.specialization)
    phase0_completed = len(phase0_missing_fields(phase0_profile)) == 0

    session = Session(
        id=new_id("session"),
        worker_id=worker.id,
        worker_name=worker.name,
        assignment=assignment,
        domain=domain,
        domain_confidence=domain_confidence,
        domain_detection_method=detection_method,
        status="live",
        started_at=utc_now_iso(),
        live_score=50.0,
        recommendation="pending",
        summary="Session in progress",
        transcript=[TranscriptItem(speaker="ai", text=first_question, timestamp=utc_now_iso())],
        snapshot_feedback=[],
        rubric_scores={},
        self_ratings=build_default_self_ratings(domain),
        prior_work_media=[],
        grounded_questions=[],
        self_awareness_profile={},
        assessment_confidence={},
        phase0_profile=phase0_profile,
        phase0_completed=phase0_completed,
        portfolio_enrichment=[],
    )
    await store.create_session(db, session)
    return SessionStartResponse(session=session, first_question=first_question)


@router.post("/sessions/{session_id}/turn", response_model=TurnResponse)
async def session_turn(
    session_id: str,
    payload: TurnRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> TurnResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    result = process_phase0_turn(session, payload.worker_text, locale) if not session.phase0_completed else run_agent_turn(session, payload.worker_text, locale)

    new_score = round(max(0.0, min(100.0, session.live_score + result["score_delta"])), 2)
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
            "phase0_profile": result.get("phase0_profile", session.phase0_profile),
            "phase0_completed": result.get("phase0_completed", session.phase0_completed),
        }
    )

    if updated.phase0_completed:
        profile = updated.phase0_profile or {}
        worker = await store.get_worker(db, updated.worker_id)
        if worker:
            years = profile.get("yearsExp")
            if years is not None:
                try:
                    await store.update_worker(db, worker.model_copy(update={"experience_years": int(years)}))
                except (TypeError, ValueError):
                    pass

    await store.update_session(db, updated)
    return TurnResponse(
        ai_question=result["ai_reply"],
        coach_note="",
        live_score=updated.live_score,
        rubric_tag=result["rubric_tag"],
        phase=result["phase"],
    )


@router.post("/sessions/{session_id}/self-ratings", response_model=SelfRatingsResponse)
async def set_self_ratings(
    session_id: str,
    payload: SelfRatingsRequest,
    db: AsyncSession = Depends(get_db),
) -> SelfRatingsResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    cleaned: dict[str, float] = {}
    valid_keys = set(session.self_ratings.keys())
    for key, value in payload.ratings.items():
        if key not in valid_keys:
            continue
        try:
            v = float(value)
        except (TypeError, ValueError):
            continue
        cleaned[key] = max(1.0, min(5.0, round(v, 1)))

    updated = session.model_copy(update={"self_ratings": {**session.self_ratings, **cleaned}})
    await store.update_session(db, updated)
    return SelfRatingsResponse(self_ratings=updated.self_ratings)


@router.post("/sessions/{session_id}/snapshot", response_model=SnapshotResponse)
async def add_snapshot_feedback(
    session_id: str,
    payload: SnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> SnapshotResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    snapshot = build_snapshot_feedback(payload.note, session.live_score, payload.image_data, session.domain)
    updated = session.model_copy(
        update={
            "snapshot_feedback": [*session.snapshot_feedback, snapshot],
            "live_score": round((session.live_score * 0.85) + (snapshot.quality_score * 0.15), 2),
        }
    )
    await store.update_session(db, updated)

    return SnapshotResponse(
        quality_score=snapshot.quality_score,
        feedback=snapshot.feedback,
        focus_areas=snapshot.focus_areas,
        snapshot_count=len(updated.snapshot_feedback),
        live_score=updated.live_score,
    )


@router.post("/sessions/{session_id}/prior-work-media", response_model=PriorWorkMediaResponse)
async def add_prior_work_media(
    session_id: str,
    payload: PriorWorkMediaRequest,
    db: AsyncSession = Depends(get_db),
) -> PriorWorkMediaResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "live":
        raise HTTPException(status_code=400, detail="Session already completed")

    media_items, grounded_questions = build_prior_work_media(payload.images, payload.note, session.domain)
    new_items = [
        PriorWorkItem(
            captured_at=utc_now_iso(),
            note=payload.note,
            vision_summary=item["summary"],
            relevance_flag=item["relevance"],
            vision_confidence=item["vision_confidence"],
        )
        for item in media_items
    ]

    updated = session.model_copy(
        update={
            "prior_work_media": [*session.prior_work_media, *new_items],
            "grounded_questions": grounded_questions,
        }
    )
    await store.update_session(db, updated)
    return PriorWorkMediaResponse(
        prior_work_media=updated.prior_work_media,
        grounded_questions=updated.grounded_questions,
    )


@router.post("/sessions/{session_id}/portfolio-enrichment", response_model=PortfolioEnrichmentResponse)
async def add_portfolio_enrichment(
    session_id: str,
    payload: PortfolioEnrichmentRequest,
    db: AsyncSession = Depends(get_db),
) -> PortfolioEnrichmentResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    items = build_portfolio_enrichment(payload.images, payload.note, session.domain)
    added = [
        PortfolioItem(
            captured_at=utc_now_iso(),
            note=payload.note,
            complexity=item["complexity"],
            vision_summary=item["summary"],
        )
        for item in items
    ]
    updated = session.model_copy(update={"portfolio_enrichment": [*session.portfolio_enrichment, *added][:8]})
    await store.update_session(db, updated)
    return PortfolioEnrichmentResponse(portfolio_enrichment=updated.portfolio_enrichment)


@router.post("/sessions/{session_id}/integrity/event", response_model=IntegrityEventResponse)
async def add_integrity_event(
    session_id: str,
    payload: IntegrityEventRequest,
    db: AsyncSession = Depends(get_db),
) -> IntegrityEventResponse:
    session = await store.get_session(db, session_id)
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
    await store.update_session(db, updated)
    return IntegrityEventResponse(
        integrity_log=next_log,
        session_paused=next_log.session_paused,
        pause_reason=next_log.pause_reason,
    )


@router.post("/sessions/{session_id}/complete", response_model=CompleteResponse)
async def complete_session(
    session_id: str,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> CompleteResponse:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        return CompleteResponse(session=session)

    completed = finalize_session(session, locale)
    await store.update_session(db, completed)
    return CompleteResponse(session=completed)


@router.get("/session/{session_id}", response_model=Session)
async def get_session_route(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> Session:
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/live", response_model=list[Session])
async def live_sessions(db: AsyncSession = Depends(get_db)) -> list[Session]:
    all_sessions = await store.get_all_sessions(db)
    return [s for s in all_sessions if s.status == "live"]


@router.get("/sessions/reports", response_model=list[Session])
async def completed_sessions(db: AsyncSession = Depends(get_db)) -> list[Session]:
    all_sessions = await store.get_all_sessions(db)
    return [s for s in all_sessions if s.status == "completed"]
