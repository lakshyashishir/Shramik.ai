from html import escape
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.integrations.phone import normalize_phone_number
from app.integrations.twilio_client import (
    TwilioConfigError,
    extract_twilio_sid,
    safe_host,
    start_outbound_call,
)
from app.models import CompleteResponse, Session, Worker, new_id, utc_now_iso
from app.services import store
from app.services.session_runtime import complete_session, create_session, require_session, update_session
from app.services.store import call_session_index

router = APIRouter(tags=["call"])


class TwilioCallStartRequest(BaseModel):
    phone_number: str = Field(min_length=10, max_length=20)
    assignment: Optional[str] = Field(default=None, max_length=400)
    worker_name: Optional[str] = Field(default=None, max_length=80)
    specialization: Optional[str] = Field(default=None, max_length=120)
    experience_years: int = Field(default=0, ge=0, le=50)


class TwilioStatusResponse(BaseModel):
    ok: bool = True
    session_id: Optional[str] = None
    status: Optional[str] = None


async def _find_worker_by_phone(db: AsyncSession, phone_number: str) -> Optional[Worker]:
    normalized = normalize_phone_number(phone_number)
    if not normalized:
        return None
    return await store.get_worker_by_phone(db, normalized)


async def _upsert_worker(
    db: AsyncSession,
    *,
    phone_number: Optional[str],
    worker_name: Optional[str],
    specialization: Optional[str],
    experience_years: int,
) -> Worker:
    normalized_phone = normalize_phone_number(phone_number)
    existing = await _find_worker_by_phone(db, normalized_phone or "") if normalized_phone else None
    if existing:
        updates = {}
        if worker_name:
            updates["name"] = worker_name.strip()
        if specialization:
            updates["specialization"] = specialization.strip()
        updates["experience_years"] = max(existing.experience_years, experience_years)
        if updates:
            updated = existing.model_copy(update=updates)
            await store.update_worker(db, updated)
            return updated
        return existing

    worker = Worker(
        id=new_id("worker"),
        name=(worker_name or "Unknown Worker").strip(),
        specialization=(specialization or "General Worker").strip(),
        experience_years=experience_years or 0,
        phone_number=normalized_phone,
        created_at=utc_now_iso(),
    )
    await store.create_worker(db, worker)
    return worker


def _twiml_response(text: str) -> Response:
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Say voice=\"alice\" language=\"hi-IN\">{escape(text)}</Say><Hangup/></Response>"
    )
    return Response(content=xml, media_type="application/xml")


def _build_greeting_text(session: Session) -> str:
    first_question = session.transcript[0].text if session.transcript else ""
    return (
        f"Namaste {session.worker_name}. Aapka Shramik.ai phone assessment shuru ho raha hai. "
        f"{first_question}"
    )


@router.post("/calls/twilio/start")
async def start_twilio_screening_call(
    payload: TwilioCallStartRequest,
    db: AsyncSession = Depends(get_db),
):
    worker = await _upsert_worker(
        db,
        phone_number=payload.phone_number,
        worker_name=payload.worker_name,
        specialization=payload.specialization,
        experience_years=payload.experience_years,
    )
    assignment = (payload.assignment or settings.twilio_default_assignment).strip()
    session, first_question = await create_session(
        db,
        worker,
        assignment,
        interview_mode="call",
        locale="hi",
        call_provider="twilio",
        call_phone_number=normalize_phone_number(payload.phone_number),
        external_call_status="queued",
    )

    try:
        outbound = await start_outbound_call(
            to_number=payload.phone_number,
            session_id=session.id,
        )
    except TwilioConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Twilio call start failed: {exc}") from exc

    session = await update_session(
        db,
        session.id,
        external_call_id=outbound.get("sid"),
        external_call_status=outbound.get("status") or "queued",
    )
    if session.external_call_id:
        call_session_index[session.external_call_id] = session.id

    return {
        "session": session,
        "first_question": first_question,
        "call": {
            "sid": outbound.get("sid"),
            "status": outbound.get("status"),
            "provider": "twilio",
            "api_host": safe_host("https://api.twilio.com"),
        },
    }


@router.api_route("/calls/twilio/twiml", methods=["GET", "POST"])
async def twilio_twiml(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    query = dict(request.query_params)
    body = dict(await request.form()) if request.method == "POST" else {}
    payload = {**query, **body}
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session = await require_session(db, str(session_id))
    return _twiml_response(_build_greeting_text(session))


@router.api_route("/calls/twilio/incoming", methods=["GET", "POST"])
async def twilio_incoming_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    query = dict(request.query_params)
    body = dict(await request.form()) if request.method == "POST" else {}
    payload: dict[str, object] = {**query, **body}

    from_number = payload.get("From") or payload.get("from") or payload.get("Caller")
    call_sid = extract_twilio_sid(payload)
    if not from_number:
        raise HTTPException(status_code=400, detail="From number is required")

    worker = await _upsert_worker(
        db,
        phone_number=str(from_number),
        worker_name="श्रमिक",
        specialization=None,
        experience_years=0,
    )

    assignment = settings.twilio_default_assignment.strip()
    session, _ = await create_session(
        db,
        worker,
        assignment,
        interview_mode="call",
        locale="hi",
        call_provider="twilio",
        call_phone_number=normalize_phone_number(str(from_number)),
        external_call_id=call_sid,
        external_call_status="inbound",
    )

    if call_sid:
        call_session_index[call_sid] = session.id

    return _twiml_response(_build_greeting_text(session))


@router.api_route("/calls/twilio/status", methods=["GET", "POST"], response_model=TwilioStatusResponse)
async def twilio_status_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TwilioStatusResponse:
    body = await request.form() if request.method == "POST" else {}
    payload = {**dict(request.query_params), **dict(body)}
    call_sid = extract_twilio_sid(payload)
    session_id = payload.get("session_id")
    status = payload.get("CallStatus") or payload.get("CallStatus".lower()) or payload.get("status")
    duration = payload.get("CallDuration") or payload.get("duration")
    recording_url = payload.get("RecordingUrl") or payload.get("recording_url")

    resolved_session_id = None
    if session_id:
        try:
            await require_session(db, str(session_id))
            resolved_session_id = str(session_id)
        except HTTPException:
            resolved_session_id = None
    if not resolved_session_id and call_sid and call_sid in call_session_index:
        resolved_session_id = call_session_index[call_sid]
    if not resolved_session_id:
        return TwilioStatusResponse(ok=True, status=str(status) if status else None)

    try:
        parsed_duration = int(duration) if duration is not None else None
    except ValueError:
        parsed_duration = None

    current = await require_session(db, resolved_session_id)
    session = await update_session(
        db,
        resolved_session_id,
        external_call_id=call_sid or current.external_call_id,
        external_call_status=str(status) if status else current.external_call_status,
        call_duration_seconds=parsed_duration or current.call_duration_seconds,
        latest_call_recording_url=str(recording_url) if recording_url else current.latest_call_recording_url,
    )
    if call_sid:
        call_session_index[call_sid] = session.id

    terminal_statuses = {"completed", "busy", "failed", "no-answer", "canceled"}
    if (session.external_call_status or "").lower() in terminal_statuses and session.status == "live":
        session = await complete_session(db, session.id, locale="hi")

    return TwilioStatusResponse(ok=True, session_id=session.id, status=session.external_call_status)
