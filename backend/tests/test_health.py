from app.api.routes.call import _build_greeting_text
from app.api.routes.health import healthcheck
from app.api.routes.sessions import (
    IntegrityEventRequest,
    SnapshotRequest,
    add_integrity_event,
    add_snapshot_feedback,
    complete_session,
    session_turn,
    start_session,
)
from app.api.routes.workers import create_worker, onboard_worker_by_voice
from app.config import settings
from app.models import SessionStartRequest, TurnRequest, WorkerCreate, WorkerVoiceOnboardRequest
from app.services.session_runtime import create_session
from app.services.store import call_session_index, sessions, workers
from fastapi.testclient import TestClient

from app.main import app


settings.azure_openai_endpoint = ""
settings.azure_openai_api_key = ""
settings.azure_openai_deployment = ""
settings.twilio_enabled = False


def setup_function() -> None:
    workers.clear()
    sessions.clear()
    call_session_index.clear()


def test_healthcheck() -> None:
    assert healthcheck() == {"ok": True}


def test_worker_and_session_flow() -> None:
    worker = create_worker(
        WorkerCreate(
            name="Rekha Devi",
            specialization="Industrial Stitching",
            experience_years=3,
        )
    )

    started = start_session(
        SessionStartRequest(
            worker_id=worker.id,
            assignment="Stitch a clean straight seam with consistent margin and explain your quality checks.",
        )
    )
    session_id = started.session.id

    turn = session_turn(session_id, TurnRequest(worker_text="I first check needle, thread tension, and fabric alignment."))
    assert turn.ai_question

    snapshot = add_snapshot_feedback(
        session_id,
        SnapshotRequest(
            image_data="data:image/jpeg;base64," + ("a" * 40),
            note="Worker showing seam line and edge finish",
        ),
    )
    assert snapshot.snapshot_count == 1

    integrity_event = add_integrity_event(
        session_id,
        IntegrityEventRequest(event="multi_face_warning", details={"faces": 2}),
    )
    assert integrity_event.integrity_log.multiface_events == 1

    completed = complete_session(session_id)
    assert completed.session.status == "completed"
    assert "integrity_compliance" in completed.session.rubric_scores


def test_voice_onboard_and_call_mode_setup() -> None:
    worker = onboard_worker_by_voice(
        WorkerVoiceOnboardRequest(
            transcript="Mera naam Raju hai. Main electrician hoon aur 6 saal se wiring ka kaam karta hoon.",
            phone_number="+919876543210",
        )
    )
    assert worker.specialization == "Electrical Work"
    assert worker.phone_number == "+919876543210"

    session, _ = create_session(
        worker,
        "Explain electrical safety checks before residential wiring work.",
        interview_mode="call",
        locale="hi",
        call_provider="twilio",
        call_phone_number=worker.phone_number,
    )
    greeting = _build_greeting_text(session)
    assert "shramik.ai phone assessment" in greeting.lower()
    assert session.call_provider == "twilio"


def test_twilio_inbound_webhook_creates_session() -> None:
    client = TestClient(app)

    call_sid = "CA1234567890abcdef1234567890"
    from_number = "+919876543210"

    resp = client.post(
        "/api/calls/twilio/incoming",
        data={
            "From": from_number,
            "CallSid": call_sid,
        },
    )
    assert resp.status_code == 200
    assert "application/xml" in (resp.headers.get("content-type") or "").lower()
    assert "phone assessment" in resp.text.lower()

    assert call_session_index.get(call_sid) is not None
    session_id = call_session_index[call_sid]
    assert session_id in sessions
