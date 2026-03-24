from app.api.routes.call import (
    ExotelSessionBootstrapRequest,
    ExotelTurnRequest,
    bootstrap_exotel_session,
    exotel_complete,
    exotel_turn,
)
from app.api.routes.health import healthcheck
from app.api.routes.sessions import (
    IntegrityEventRequest,
    SnapshotRequest,
    add_integrity_event,
    add_snapshot_feedback,
    complete_session,
    start_session,
)
from app.api.routes.workers import create_worker, onboard_worker_by_voice
from app.config import settings
from app.models import SessionStartRequest, TurnRequest, WorkerCreate, WorkerVoiceOnboardRequest
from app.services.store import call_session_index, sessions, workers


settings.azure_openai_endpoint = ""
settings.azure_openai_api_key = ""
settings.azure_openai_deployment = ""
settings.exotel_enabled = False


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

    turn = exotel_turn(ExotelTurnRequest(session_id=session_id, transcript="I first check needle, thread tension, and fabric alignment."))
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


def test_voice_onboard_and_call_mode_flow() -> None:
    worker = onboard_worker_by_voice(
        WorkerVoiceOnboardRequest(
            transcript="Mera naam Raju hai. Main electrician hoon aur 6 saal se wiring ka kaam karta hoon.",
            phone_number="+919876543210",
        )
    )
    assert worker.specialization == "Electrical Work"
    assert worker.phone_number == "09876543210"

    bootstrap = bootstrap_exotel_session(
        ExotelSessionBootstrapRequest(
            call_sid="call_sid_001",
            from_number="+919876543210",
            assignment="Explain electrical safety checks before residential wiring work.",
        )
    )
    assert "phone assessment" in bootstrap.greeting.lower()

    turn = exotel_turn(
        ExotelTurnRequest(
            call_sid="call_sid_001",
            transcript="Main pehle main switch band karta hoon, tester se line check karta hoon aur phir insulated tools use karta hoon.",
        )
    )
    assert turn.ai_question

    completed = exotel_complete(
        call_sid="call_sid_001",
        duration_seconds=143,
        final_status="completed",
        recording_url="https://example.com/recording.wav",
    )
    assert completed.session.status == "completed"
    assert completed.session.interview_mode == "call"
    assert completed.session.call_duration_seconds == 143
