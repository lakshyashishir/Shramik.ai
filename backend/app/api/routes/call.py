from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.agents.screening_logic import extract_worker_profile_from_text
from app.config import settings
from app.integrations.exotel.client import (
    ExotelConfigError,
    extract_exotel_sid,
    normalize_indian_phone_number,
    safe_host,
    start_outbound_call,
)
from app.models import CompleteResponse, TurnResponse, Worker, new_id, utc_now_iso
from app.services.session_runtime import append_turn, complete_session, create_session, require_session, update_session
from app.services.store import call_session_index, workers

router = APIRouter(tags=["call"])


class ExotelCallStartRequest(BaseModel):
    phone_number: str = Field(min_length=10, max_length=20)
    assignment: Optional[str] = Field(default=None, max_length=400)
    worker_name: Optional[str] = Field(default=None, max_length=80)
    specialization: Optional[str] = Field(default=None, max_length=120)
    experience_years: int = Field(default=0, ge=0, le=50)


class ExotelSessionBootstrapRequest(BaseModel):
    call_sid: Optional[str] = None
    from_number: Optional[str] = None
    assignment: Optional[str] = Field(default=None, max_length=400)
    worker_name: Optional[str] = Field(default=None, max_length=80)
    specialization: Optional[str] = Field(default=None, max_length=120)
    experience_years: int = Field(default=0, ge=0, le=50)
    transcript: Optional[str] = Field(default=None, max_length=600)


class ExotelSessionBootstrapResponse(BaseModel):
    session_id: str
    worker_id: str
    greeting: str
    first_question: str
    assignment: str


class ExotelTurnRequest(BaseModel):
    session_id: Optional[str] = None
    call_sid: Optional[str] = None
    transcript: str = Field(min_length=1, max_length=600)
    rubric_tag: Optional[str] = None
    acoustic_confidence: Optional[float] = None


class ExotelStatusResponse(BaseModel):
    ok: bool = True
    session_id: Optional[str] = None
    status: Optional[str] = None


def _find_worker_by_phone(phone_number: str) -> Optional[Worker]:
    normalized = normalize_indian_phone_number(phone_number)
    for worker in workers.values():
        if normalize_indian_phone_number(worker.phone_number or "") == normalized:
            return worker
    return None


def _upsert_worker(
    *,
    phone_number: Optional[str],
    worker_name: Optional[str],
    specialization: Optional[str],
    experience_years: int,
    transcript: Optional[str] = None,
) -> Worker:
    extracted = extract_worker_profile_from_text(transcript or "") if transcript else {}
    normalized_phone = normalize_indian_phone_number(phone_number)
    existing = _find_worker_by_phone(normalized_phone or "") if normalized_phone else None
    if existing:
        updates = {}
        if worker_name:
            updates["name"] = worker_name.strip()
        elif extracted.get("name") and existing.name == "Unknown Worker":
            updates["name"] = extracted["name"]
        if specialization:
            updates["specialization"] = specialization.strip()
        elif extracted.get("specialization") and existing.specialization == "General Worker":
            updates["specialization"] = extracted["specialization"]
        next_experience = experience_years or extracted.get("experience_years") or existing.experience_years
        updates["experience_years"] = max(existing.experience_years, next_experience)
        if updates:
            updated = existing.model_copy(update=updates)
            workers[existing.id] = updated
            return updated
        return existing

    worker = Worker(
        id=new_id("worker"),
        name=(worker_name or extracted.get("name") or "Unknown Worker").strip(),
        specialization=(specialization or extracted.get("specialization") or "General Worker").strip(),
        experience_years=experience_years or extracted.get("experience_years") or 0,
        phone_number=normalized_phone,
        created_at=utc_now_iso(),
    )
    workers[worker.id] = worker
    return worker


def _resolve_session_id(session_id: Optional[str], call_sid: Optional[str]) -> str:
    if session_id:
        require_session(session_id)
        return session_id
    if call_sid and call_sid in call_session_index:
        return call_session_index[call_sid]
    raise HTTPException(status_code=404, detail="Call session not found")


def _bootstrap_session(payload: ExotelSessionBootstrapRequest) -> ExotelSessionBootstrapResponse:
    worker = _upsert_worker(
        phone_number=payload.from_number,
        worker_name=payload.worker_name,
        specialization=payload.specialization,
        experience_years=payload.experience_years,
        transcript=payload.transcript,
    )
    assignment = (payload.assignment or settings.exotel_default_assignment).strip()
    session, first_question = create_session(
        worker,
        assignment,
        interview_mode="call",
        call_provider="exotel",
        call_phone_number=normalize_indian_phone_number(payload.from_number),
        external_call_id=payload.call_sid,
        external_call_status="in-progress" if payload.call_sid else None,
    )
    if payload.call_sid:
        call_session_index[payload.call_sid] = session.id

    greeting = (
        f"Namaste {worker.name}. Aapka Shramik.ai phone assessment shuru ho raha hai."
    )
    return ExotelSessionBootstrapResponse(
        session_id=session.id,
        worker_id=worker.id,
        greeting=greeting,
        first_question=first_question,
        assignment=assignment,
    )


@router.post("/calls/exotel/start")
async def start_exotel_screening_call(payload: ExotelCallStartRequest):
    worker = _upsert_worker(
        phone_number=payload.phone_number,
        worker_name=payload.worker_name,
        specialization=payload.specialization,
        experience_years=payload.experience_years,
    )
    assignment = (payload.assignment or settings.exotel_default_assignment).strip()
    session, first_question = create_session(
        worker,
        assignment,
        interview_mode="call",
        call_provider="exotel",
        call_phone_number=normalize_indian_phone_number(payload.phone_number),
        external_call_status="queued",
    )

    try:
        outbound = await start_outbound_call(
            to_number=payload.phone_number,
            custom_field=session.id,
        )
    except ExotelConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Exotel call start failed: {exc}") from exc

    session = update_session(
        session.id,
        external_call_id=outbound.get("sid"),
        external_call_status=outbound.get("status") or "queued",
    )
    if session.external_call_id:
        call_session_index[session.external_call_id] = session.id

    return {
        "session": session,
        "first_question": first_question,
        "exotel": {
            "sid": outbound.get("sid"),
            "status": outbound.get("status"),
            "api_host": safe_host(settings.exotel_api_host),
        },
    }


@router.post("/calls/exotel/session", response_model=ExotelSessionBootstrapResponse)
def bootstrap_exotel_session(payload: ExotelSessionBootstrapRequest) -> ExotelSessionBootstrapResponse:
    return _bootstrap_session(payload)


@router.get("/calls/exotel/session", response_model=ExotelSessionBootstrapResponse)
def bootstrap_exotel_session_from_query(
    call_sid: Optional[str] = None,
    from_number: Optional[str] = None,
    assignment: Optional[str] = None,
    worker_name: Optional[str] = None,
    specialization: Optional[str] = None,
    experience_years: int = 0,
    transcript: Optional[str] = None,
) -> ExotelSessionBootstrapResponse:
    return _bootstrap_session(
        ExotelSessionBootstrapRequest(
            call_sid=call_sid,
            from_number=from_number,
            assignment=assignment,
            worker_name=worker_name,
            specialization=specialization,
            experience_years=experience_years,
            transcript=transcript,
        )
    )


@router.post("/calls/exotel/turn", response_model=TurnResponse)
def exotel_turn(payload: ExotelTurnRequest) -> TurnResponse:
    session_id = _resolve_session_id(payload.session_id, payload.call_sid)
    _, response = append_turn(
        session_id,
        payload.transcript,
        rubric_tag=payload.rubric_tag,
        acoustic_confidence=payload.acoustic_confidence,
    )
    return response


@router.post("/calls/exotel/complete", response_model=CompleteResponse)
def exotel_complete(
    session_id: Optional[str] = None,
    call_sid: Optional[str] = None,
    duration_seconds: Optional[int] = None,
    recording_url: Optional[str] = None,
    final_status: Optional[str] = None,
) -> CompleteResponse:
    resolved_session_id = _resolve_session_id(session_id, call_sid)
    session = require_session(resolved_session_id)
    session = update_session(
        session.id,
        call_duration_seconds=duration_seconds or session.call_duration_seconds,
        latest_call_recording_url=recording_url or session.latest_call_recording_url,
        external_call_status=final_status or session.external_call_status,
    )
    completed = complete_session(session.id)
    return CompleteResponse(session=completed)


@router.api_route("/calls/exotel/status", methods=["GET", "POST"], response_model=ExotelStatusResponse)
async def exotel_status_callback(request: Request) -> ExotelStatusResponse:
    body = await request.form() if request.method == "POST" else {}
    payload = {**dict(request.query_params), **dict(body)}
    call_sid = extract_exotel_sid(payload)
    custom_field = payload.get("CustomField") or payload.get("custom_field")
    status = payload.get("CallStatus") or payload.get("Status") or payload.get("status")
    duration = payload.get("DialCallDuration") or payload.get("CallDuration") or payload.get("duration")
    recording_url = payload.get("RecordingUrl") or payload.get("recording_url")

    session_id = None
    if call_sid and call_sid in call_session_index:
        session_id = call_session_index[call_sid]
    elif custom_field:
        candidate = str(custom_field)
        if candidate in workers or candidate.startswith("worker_"):
            candidate = None
        if candidate:
            try:
                require_session(candidate)
                session_id = candidate
            except HTTPException:
                session_id = None

    if not session_id:
        return ExotelStatusResponse(ok=True, status=str(status) if status else None)

    try:
        parsed_duration = int(duration) if duration is not None else None
    except ValueError:
        parsed_duration = None

    session = update_session(
        session_id,
        external_call_id=call_sid or require_session(session_id).external_call_id,
        external_call_status=str(status) if status else require_session(session_id).external_call_status,
        call_duration_seconds=parsed_duration or require_session(session_id).call_duration_seconds,
        latest_call_recording_url=str(recording_url) if recording_url else require_session(session_id).latest_call_recording_url,
    )
    if call_sid:
        call_session_index[call_sid] = session.id
    return ExotelStatusResponse(ok=True, session_id=session.id, status=session.external_call_status)
