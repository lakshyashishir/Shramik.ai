import base64
from html import escape
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.screening_logic import (
    choose_opening_question,
    finalize_session,
    run_agent_turn,
)
from app.config import settings
from app.database import get_db
from app.integrations.phone import normalize_phone_number
from app.integrations.twilio_client import (
    TwilioConfigError,
    extract_twilio_sid,
    is_twilio_configured,
    safe_host,
    start_outbound_call,
)
from app.models import Session, TranscriptItem, Worker, new_id, utc_now_iso
from app.services import store
from app.services.sarvam_speech import TTS_URL, sarvam_headers, transcribe_audio_bytes

router = APIRouter(tags=["call"])

# In-memory mapping of Twilio CallSid → session_id (acceptable loss on restart)
_call_session_index: dict[str, str] = {}


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


# ── Worker helpers ────────────────────────────────────────────────────────────

async def _upsert_worker(
    db: AsyncSession,
    *,
    phone_number: Optional[str],
    worker_name: Optional[str],
    specialization: Optional[str],
    experience_years: int,
) -> Worker:
    normalized_phone = normalize_phone_number(phone_number) if phone_number else None

    if normalized_phone:
        existing = await store.get_worker_by_phone(db, normalized_phone)
        if existing:
            updates: dict = {"experience_years": max(existing.experience_years, experience_years)}
            if worker_name:
                updates["name"] = worker_name.strip()
            if specialization:
                updates["specialization"] = specialization.strip()
            updated = existing.model_copy(update=updates)
            await store.update_worker(db, updated)
            return updated

    worker = Worker(
        id=new_id("worker"),
        name=(worker_name or "Unknown Worker").strip(),
        specialization=(specialization or "General Worker").strip(),
        experience_years=experience_years or 0,
        created_at=utc_now_iso(),
        phone_number=normalized_phone,
    )
    await store.create_worker(db, worker)
    return worker


async def _create_call_session(
    db: AsyncSession,
    worker: Worker,
    assignment: str,
    *,
    external_call_id: Optional[str] = None,
    external_call_status: Optional[str] = None,
    call_phone_number: Optional[str] = None,
) -> tuple[Session, str]:
    first_question = choose_opening_question(worker.name, assignment, "hi")
    session = Session(
        id=new_id("session"),
        worker_id=worker.id,
        worker_name=worker.name,
        assignment=assignment,
        status="live",
        started_at=utc_now_iso(),
        live_score=50.0,
        recommendation="pending",
        summary="Session in progress",
        transcript=[TranscriptItem(speaker="ai", text=first_question, timestamp=utc_now_iso())],
        snapshot_feedback=[],
        rubric_scores={},
        phase0_completed=True,  # skip onboarding questions for phone calls
        interview_mode="call",
        call_provider="twilio",
        call_phone_number=call_phone_number,
        external_call_id=external_call_id,
        external_call_status=external_call_status,
    )
    await store.create_session(db, session)
    return session, first_question


# ── TwiML helpers ─────────────────────────────────────────────────────────────

def _last_ai_text(session: Session) -> str:
    for item in reversed(session.transcript):
        if item.speaker == "ai":
            return item.text
    return "Namaste! Shramik.ai screening mein aapka swagat hai."


def _audio_url(session_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/calls/twilio/audio/{session_id}"


def _voice_turn_url(session_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/calls/twilio/voice-turn?session_id={session_id}"


def _twiml_play_and_record(session_id: str) -> Response:
    """Play latest AI message via Sarvam TTS, then record the worker's reply."""
    audio = escape(_audio_url(session_id))
    action = escape(_voice_turn_url(session_id))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Play>{audio}</Play>"
        f'<Record maxLength="45" action="{action}" method="POST"'
        ' playBeep="false" trim="trim-silence" timeout="5"/>'
        "</Response>"
    )
    return Response(content=xml, media_type="application/xml")


def _twiml_play_and_hangup(session_id: str) -> Response:
    """Play the farewell/passport message then end the call."""
    audio = escape(_audio_url(session_id))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Play>{audio}</Play>"
        "<Hangup/>"
        "</Response>"
    )
    return Response(content=xml, media_type="application/xml")


# ── TTS audio endpoint ────────────────────────────────────────────────────────

@router.get("/calls/twilio/audio/{session_id}")
async def call_tts_audio(session_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    """
    Stream Sarvam TTS audio for the latest AI transcript item.
    Used as the <Play> target URL in TwiML.
    """
    session = await store.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    text = _last_ai_text(session)
    headers = sarvam_headers()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TTS_URL,
            headers={**headers, "Content-Type": "application/json"},
            json={
                "inputs": [text],
                "target_language_code": "hi-IN",
                "speaker": "anushka",
                "model": "bulbul:v2",
                "enable_preprocessing": True,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TTS error: {resp.text[:200]}")

    data = resp.json()
    audios = data.get("audios", [])
    if not audios:
        raise HTTPException(status_code=502, detail="No audio returned from TTS")

    return Response(content=base64.b64decode(audios[0]), media_type="audio/wav")


# ── Voice-turn loop ───────────────────────────────────────────────────────────

@router.api_route("/calls/twilio/voice-turn", methods=["GET", "POST"])
async def twilio_voice_turn(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    """
    Twilio posts here after each <Record> completes.
    Downloads the recording → Sarvam STT → agent turn → returns next TwiML.
    """
    query = dict(request.query_params)
    body = dict(await request.form()) if request.method == "POST" else {}
    payload: dict[str, object] = {**query, **body}

    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session = await store.get_session(db, str(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "live":
        return _twiml_play_and_hangup(str(session_id))

    # Transcribe the worker's recording
    recording_url = payload.get("RecordingUrl") or payload.get("recording_url")
    worker_text = ""

    if recording_url:
        try:
            wav_url = str(recording_url).rstrip("/") + ".wav"
            auth = (settings.twilio_account_sid, settings.twilio_auth_token) if is_twilio_configured() else None
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                rec_resp = await client.get(wav_url, auth=auth)
            if rec_resp.status_code == 200:
                stt = await transcribe_audio_bytes(
                    rec_resp.content,
                    filename="recording.wav",
                    content_type="audio/wav",
                    language_code="hi-IN",
                )
                worker_text = stt.get("transcript", "").strip()
        except Exception:
            worker_text = ""

    if not worker_text:
        # Nothing heard — re-play the last question
        return _twiml_play_and_record(str(session_id))

    # Run the AI turn
    result = run_agent_turn(session, worker_text, "hi")
    new_score = round(max(0.0, min(100.0, session.live_score + result["score_delta"])), 2)
    updated = session.model_copy(
        update={
            "transcript": [
                *session.transcript,
                TranscriptItem(speaker="worker", text=worker_text, timestamp=utc_now_iso()),
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
    await store.update_session(db, updated)

    if updated.current_phase == "passport":
        return _twiml_play_and_hangup(str(session_id))

    return _twiml_play_and_record(str(session_id))


# ── Outbound call start ───────────────────────────────────────────────────────

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
    session, first_question = await _create_call_session(
        db,
        worker,
        assignment,
        external_call_status="queued",
        call_phone_number=normalize_phone_number(payload.phone_number),
    )

    try:
        outbound = await start_outbound_call(to_number=payload.phone_number, session_id=session.id)
    except TwilioConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Twilio call start failed: {exc}") from exc

    call_sid = outbound.get("sid")
    updated = session.model_copy(
        update={
            "external_call_id": call_sid,
            "external_call_status": outbound.get("status") or "queued",
        }
    )
    await store.update_session(db, updated)
    if call_sid:
        _call_session_index[call_sid] = session.id

    return {
        "session": updated,
        "first_question": first_question,
        "call": {
            "sid": call_sid,
            "status": outbound.get("status"),
            "provider": "twilio",
            "api_host": safe_host("https://api.twilio.com"),
        },
    }


@router.api_route("/calls/twilio/twiml", methods=["GET", "POST"])
async def twilio_twiml(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    query = dict(request.query_params)
    body = dict(await request.form()) if request.method == "POST" else {}
    payload = {**query, **body}
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session = await store.get_session(db, str(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return _twiml_play_and_record(str(session_id))


@router.api_route("/calls/twilio/incoming", methods=["GET", "POST"])
async def twilio_incoming_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Incoming voice webhook for when a caller dials the Twilio number directly.
    Creates a session and starts the interview loop.
    """
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

    session, _ = await _create_call_session(
        db,
        worker,
        settings.twilio_default_assignment.strip(),
        external_call_id=call_sid,
        external_call_status="inbound",
        call_phone_number=normalize_phone_number(str(from_number)),
    )

    if call_sid:
        _call_session_index[call_sid] = session.id

    return _twiml_play_and_record(session.id)


@router.api_route("/calls/twilio/status", methods=["GET", "POST"], response_model=TwilioStatusResponse)
async def twilio_status_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TwilioStatusResponse:
    body = await request.form() if request.method == "POST" else {}
    payload = {**dict(request.query_params), **dict(body)}
    call_sid = extract_twilio_sid(payload)
    session_id = payload.get("session_id")
    status = payload.get("CallStatus") or payload.get("callstatus") or payload.get("status")
    duration = payload.get("CallDuration") or payload.get("duration")

    # Resolve session
    session: Optional[Session] = None
    if session_id:
        session = await store.get_session(db, str(session_id))
    if not session and call_sid:
        if call_sid in _call_session_index:
            session = await store.get_session(db, _call_session_index[call_sid])
        if not session:
            session = await store.get_session_by_call_id(db, call_sid)

    if not session:
        return TwilioStatusResponse(ok=True, status=str(status) if status else None)

    updates: dict = {}
    if call_sid:
        updates["external_call_id"] = call_sid
        _call_session_index[call_sid] = session.id
    if status:
        updates["external_call_status"] = str(status)
    if duration is not None:
        try:
            updates["call_duration_seconds"] = int(duration)
        except ValueError:
            pass

    if updates:
        session = session.model_copy(update=updates)
        await store.update_session(db, session)

    terminal_statuses = {"completed", "busy", "failed", "no-answer", "canceled"}
    if (session.external_call_status or "").lower() in terminal_statuses and session.status == "live":
        completed = finalize_session(session, "hi")
        await store.update_session(db, completed)
        session = completed

    return TwilioStatusResponse(ok=True, session_id=session.id, status=session.external_call_status)
