from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
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
    Worker,
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
    "general_labor": "Complete behavioral registration interview for labor-pool placement.",
    "domain_unknown": "Complete behavioral registration interview for labor-pool placement.",
}
DEFAULT_ASSIGNMENT = ASSIGNMENT_TEMPLATES["garment_worker"]


class LaborPathStartRequest(BaseModel):
    sessionId: str
    triggerType: str = "classification_failure"


class LaborPathTranscriptRequest(BaseModel):
    sessionId: str
    worker_text: str
    rubric_tag: str | None = None
    acoustic_confidence: float | None = None


class LaborPathFinalizeRequest(BaseModel):
    sessionId: str


class IntakeRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    age: int = Field(ge=14, le=80)
    sex: str = Field(min_length=1, max_length=20)
    address: str = Field(min_length=2, max_length=160)
    tradeRaw: str = Field(min_length=1, max_length=240)
    yearsExp: int = Field(ge=0, le=50)


class ClassifyRequest(BaseModel):
    tradeRaw: str = Field(min_length=1, max_length=240)
    clarification: str | None = Field(default=None, max_length=240)


class AssessmentSessionRequest(BaseModel):
    workerId: str = Field(min_length=3, max_length=60)
    assignment: str | None = Field(default=None, max_length=400)


class TranscriptChunkRequest(BaseModel):
    sessionId: str
    worker_text: str = Field(min_length=1, max_length=600)
    rubric_tag: str | None = None
    acoustic_confidence: float | None = None


class EvidenceRequest(BaseModel):
    sessionId: str
    image_data: str = Field(min_length=30)
    note: str = Field(default="", max_length=240)


class AssessmentPriorWorkMediaRequest(BaseModel):
    sessionId: str
    images: list[str] = Field(min_length=1, max_length=3)
    note: str = Field(default="", max_length=280)


class AssessmentPortfolioEnrichmentRequest(BaseModel):
    sessionId: str
    images: list[str] = Field(min_length=1, max_length=8)
    note: str = Field(default="", max_length=280)


class RecruiterApproveRequest(BaseModel):
    sessionId: str
    approvedRole: str = Field(min_length=2, max_length=120)
    notes: str = Field(default="", max_length=500)


class LaborPoolMatchRequest(BaseModel):
    job_category: str
    city: str | None = None
    placement_readiness_label: str | None = None
    availability_tag: str | None = None
    physical_capability_tag: str | None = None
    training_aspiration: str | None = None


def _recompute_integrity(log: IntegrityLog) -> IntegrityLog:
    if log.face_change_detected:
        return log.model_copy(update={"overall_flag": "critical_flag", "integrity_score": 0.2})
    if log.session_paused:
        return log.model_copy(update={"overall_flag": "requires_review", "integrity_score": 0.5})
    if log.multiface_events > 0 or log.gaze_deviation_events > 0 or log.face_absent_events > 0:
        return log.model_copy(update={"overall_flag": "minor_warning", "integrity_score": 0.85})
    return log.model_copy(update={"overall_flag": "clear", "integrity_score": 1.0})


def _is_labor_domain(domain: str | None) -> bool:
    return (domain or "") in {"general_labor", "domain_unknown"}


def _classification_payload(domain: str, confidence: float, method: str) -> dict:
    return {
        "domain": domain,
        "subDomain": None,
        "confidence": round(float(confidence), 2),
        "method": method,
        "isSkilled": not _is_labor_domain(domain),
    }


def _path_decision(domain: str, confidence: float) -> str:
    if _is_labor_domain(domain):
        return "labor"
    return "skilled" if confidence >= 0.70 else "labor"


@router.post("/assessment/intake")
async def assessment_intake(
    payload: IntakeRequest,
    db: AsyncSession = Depends(get_db),
):
    specialization = payload.tradeRaw.strip()
    worker = await store.create_worker(
        db,
        Worker(
            id=new_id("worker"),
            name=payload.name.strip(),
            specialization=specialization,
            experience_years=int(payload.yearsExp),
            created_at=utc_now_iso(),
        ),
    )
    domain, confidence, method = classify_trade_with_confidence(
        specialization,
        f"{payload.yearsExp} years",
    )
    return {
        "candidateId": worker.id,
        "classificationResult": _classification_payload(domain, confidence, method),
        "pathDecision": _path_decision(domain, confidence),
    }


@router.post("/assessment/classify")
async def assessment_classify(payload: ClassifyRequest):
    joined = payload.tradeRaw if not payload.clarification else f"{payload.tradeRaw} | {payload.clarification}"
    domain, confidence, method = classify_trade_with_confidence(joined)
    return {
        "classificationResult": _classification_payload(domain, confidence, method),
        "pathDecision": _path_decision(domain, confidence),
    }


@router.get("/assessment/grounded-questions/{session_id}")
async def assessment_grounded_questions(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"sessionId": session.id, "groundedQuestions": session.grounded_questions}


@router.post("/assessment/session")
async def assessment_session_start(
    payload: AssessmentSessionRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
):
    raw_assignment = payload.assignment if payload.assignment is not None else DEFAULT_ASSIGNMENT
    assignment = raw_assignment.strip() or DEFAULT_ASSIGNMENT
    started = await start_session(
        SessionStartRequest(worker_id=payload.workerId, assignment=assignment),
        locale,
        db,
    )
    return {"sessionId": started.session.id, "websocketToken": "", "firstQuestion": started.first_question}


@router.post("/assessment/transcript-chunk", response_model=TurnResponse)
async def assessment_transcript_chunk(
    payload: TranscriptChunkRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> TurnResponse:
    return await session_turn(
        payload.sessionId,
        TurnRequest(
            worker_text=payload.worker_text,
            rubric_tag=payload.rubric_tag,
            acoustic_confidence=payload.acoustic_confidence,
        ),
        locale,
        db,
    )


@router.post("/assessment/evidence")
async def assessment_evidence(
    payload: EvidenceRequest,
    db: AsyncSession = Depends(get_db),
):
    response = await add_snapshot_feedback(
        payload.sessionId,
        SnapshotRequest(image_data=payload.image_data, note=payload.note),
        db,
    )
    return {
        "sessionId": payload.sessionId,
        "quality_score": response.quality_score,
        "vision_score_delta": round(response.quality_score - response.live_score, 2),
        "focus_areas": response.focus_areas,
    }


@router.post("/assessment/prior-work-media")
async def assessment_prior_work_media(
    payload: AssessmentPriorWorkMediaRequest,
    db: AsyncSession = Depends(get_db),
):
    response = await add_prior_work_media(
        payload.sessionId,
        PriorWorkMediaRequest(images=payload.images, note=payload.note),
        db,
    )
    return {
        "sessionId": payload.sessionId,
        "mediaAnnotation": [item.model_dump() for item in response.prior_work_media],
        "groundedQuestions": response.grounded_questions,
    }


@router.post("/assessment/portfolio-enrichment")
async def assessment_portfolio_enrichment(
    payload: AssessmentPortfolioEnrichmentRequest,
    db: AsyncSession = Depends(get_db),
):
    response = await add_portfolio_enrichment(
        payload.sessionId,
        PortfolioEnrichmentRequest(images=payload.images, note=payload.note),
        db,
    )
    return {
        "sessionId": payload.sessionId,
        "portfolioItems": [item.model_dump() for item in response.portfolio_enrichment],
    }


@router.post("/scoring/finalize")
async def scoring_finalize(
    payload: LaborPathFinalizeRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
):
    completed = await complete_session(payload.sessionId, locale, db)
    return {
        "sessionId": completed.session.id,
        "profileType": "labor_pool_profile" if _is_labor_domain(completed.session.domain) else "skill_passport",
        "overallScore": completed.session.live_score,
        "overallBand": completed.session.recommendation,
        "rubricScores": completed.session.rubric_scores,
        "selfAwarenessProfile": completed.session.self_awareness_profile,
        "assessmentConfidence": completed.session.assessment_confidence,
        "laborPoolProfile": completed.session.labor_pool_profile,
    }


@router.post("/sessions/start", response_model=SessionStartResponse)
async def start_session(
    payload: SessionStartRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> SessionStartResponse:
    worker = await store.get_worker(db, payload.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    assignment_text = payload.assignment.strip()
    assignment_for_classification = assignment_text
    if not assignment_for_classification or assignment_for_classification.lower() == DEFAULT_ASSIGNMENT.lower():
        assignment_for_classification = ""

    domain, domain_confidence, detection_method = classify_trade_with_confidence(
        worker.specialization,
        assignment_for_classification,
    )
    assignment = assignment_text
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
    if session.domain in {"general_labor", "domain_unknown"}:
        raise HTTPException(status_code=400, detail="Snapshot task is not used for general labor path")

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
    if session.domain in {"general_labor", "domain_unknown"}:
        raise HTTPException(status_code=400, detail="Prior work media is not required for general labor path")

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


@router.post("/assessment/labor-path/start")
async def labor_path_start(
    payload: LaborPathStartRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await store.get_session(db, payload.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    updated = session.model_copy(
        update={
            "domain": "general_labor",
            "domain_detection_method": payload.triggerType,
            "assignment": ASSIGNMENT_TEMPLATES["general_labor"],
            "current_phase": "intro",
        }
    )
    await store.update_session(db, updated)
    return {
        "sessionId": updated.id,
        "triggerType": payload.triggerType,
        "behavioralDimensions": [
            "attitude_motivation",
            "reliability_punctuality",
            "learnability_openness",
            "physical_readiness",
            "availability_flexibility",
        ],
    }


@router.post("/assessment/labor-path/transcript-chunk", response_model=TurnResponse)
async def labor_path_transcript_chunk(
    payload: LaborPathTranscriptRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
) -> TurnResponse:
    return await session_turn(
        payload.sessionId,
        TurnRequest(
            worker_text=payload.worker_text,
            rubric_tag=payload.rubric_tag,
            acoustic_confidence=payload.acoustic_confidence,
        ),
        locale,
        db,
    )


@router.post("/scoring/labor-path/finalize")
async def labor_path_finalize(
    payload: LaborPathFinalizeRequest,
    locale: str = Query("en"),
    db: AsyncSession = Depends(get_db),
):
    completed = await complete_session(payload.sessionId, locale, db)
    return {
        "sessionId": completed.session.id,
        "profileType": "labor_pool_profile",
        "laborPoolProfile": completed.session.labor_pool_profile,
        "assessmentConfidence": completed.session.assessment_confidence,
    }


@router.get("/recruiter/labor-pool")
async def recruiter_labor_pool(
    placement_readiness_label: str | None = Query(default=None),
    availability_tags: str | None = Query(default=None),
    physical_capability_tags: str | None = Query(default=None),
    training_aspiration: str | None = Query(default=None),
    city: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    pool = []
    all_sessions = await store.get_all_sessions(db)
    for s in all_sessions:
        if s.status != "completed":
            continue
        if s.domain not in {"general_labor", "domain_unknown"}:
            continue
        labor = s.labor_pool_profile or {}
        placement = (labor.get("placementReadiness") or {}).get("label")
        availability_blob = str(labor.get("availabilityTags", ""))
        physical_blob = str(labor.get("physicalCapabilityTags", ""))
        aspiration = str(labor.get("trainingAspiration", ""))
        profile_city = str((labor.get("identity") or {}).get("address", "")).lower()

        if placement_readiness_label and str(placement).lower() != placement_readiness_label.lower():
            continue
        if availability_tags and availability_tags.lower() not in availability_blob.lower():
            continue
        if physical_capability_tags and physical_capability_tags.lower() not in physical_blob.lower():
            continue
        if training_aspiration and training_aspiration.lower() not in aspiration.lower():
            continue
        if city and city.lower() not in profile_city:
            continue

        pool.append(
            {
                "sessionId": s.id,
                "workerId": s.worker_id,
                "workerName": s.worker_name,
                "placementReadiness": labor.get("placementReadiness", {}),
                "assessmentConfidence": s.assessment_confidence,
            }
        )
    return pool


@router.get("/recruiter/labor-pool/{session_id}")
async def recruiter_labor_pool_one(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    s = await store.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if s.domain not in {"general_labor", "domain_unknown"}:
        raise HTTPException(status_code=400, detail="Session is not a general labor profile")
    return {
        "sessionId": s.id,
        "workerId": s.worker_id,
        "workerName": s.worker_name,
        "laborPoolProfile": s.labor_pool_profile,
        "assessmentConfidence": s.assessment_confidence,
    }


@router.post("/recruiter/labor-pool/match")
async def recruiter_labor_pool_match(
    payload: LaborPoolMatchRequest,
    db: AsyncSession = Depends(get_db),
):
    candidates = await recruiter_labor_pool(
        placement_readiness_label=payload.placement_readiness_label,
        availability_tags=payload.availability_tag,
        physical_capability_tags=payload.physical_capability_tag,
        training_aspiration=payload.training_aspiration,
        city=payload.city,
        db=db,
    )

    ranked = sorted(
        candidates,
        key=lambda c: (
            float((c.get("placementReadiness") or {}).get("score", 0.0)),
            float((c.get("assessmentConfidence") or {}).get("overallConfidence", 0.0)),
        ),
        reverse=True,
    )
    return {"jobCategory": payload.job_category, "matches": ranked}


@router.get("/recruiter/candidates/{session_id}")
async def recruiter_candidate_card(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    s = await store.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "candidateId": s.worker_id,
        "sessionId": s.id,
        "domain": s.domain,
        "rubricScores": s.rubric_scores,
        "selfAwarenessProfile": s.self_awareness_profile,
        "assessmentConfidence": s.assessment_confidence,
        "integrityLog": s.integrity_log,
        "mediaAnnotations": [item.model_dump() for item in s.prior_work_media],
        "portfolioEnrichment": [item.model_dump() for item in s.portfolio_enrichment],
        "recruiterDecision": s.recruiter_decision,
    }


@router.post("/recruiter/assignment/approve")
async def recruiter_assignment_approve(
    payload: RecruiterApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    s = await store.get_session(db, payload.sessionId)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    decision = {
        "approvedRole": payload.approvedRole.strip(),
        "notes": payload.notes.strip(),
        "approvedAt": utc_now_iso(),
    }
    updated = s.model_copy(update={"recruiter_decision": decision})
    await store.update_session(db, updated)
    return {"sessionId": updated.id, "recruiterDecision": decision}
