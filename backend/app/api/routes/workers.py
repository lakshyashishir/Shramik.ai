from fastapi import APIRouter

from app.agents.screening_logic import extract_worker_profile_from_text
from app.integrations.phone import normalize_phone_number
from app.models import Worker, WorkerCreate, WorkerVoiceOnboardRequest, new_id, utc_now_iso
from app.services.store import workers

router = APIRouter(tags=["workers"])


@router.post("/workers", response_model=Worker)
def create_worker(payload: WorkerCreate) -> Worker:
    worker = Worker(
        id=new_id("worker"),
        name=payload.name.strip(),
        specialization=payload.specialization.strip(),
        experience_years=int(payload.experience_years),
        phone_number=normalize_phone_number(payload.phone_number.strip()) if payload.phone_number else None,
        created_at=utc_now_iso(),
    )
    workers[worker.id] = worker
    return worker


@router.post("/workers/onboard", response_model=Worker)
def onboard_worker_by_voice(payload: WorkerVoiceOnboardRequest) -> Worker:
    profile = extract_worker_profile_from_text(payload.transcript)
    worker = Worker(
        id=new_id("worker"),
        name=profile["name"],
        specialization=profile["specialization"],
        experience_years=profile["experience_years"],
        phone_number=normalize_phone_number(payload.phone_number.strip()) if payload.phone_number else None,
        created_at=utc_now_iso(),
    )
    workers[worker.id] = worker
    return worker


@router.get("/workers", response_model=list[Worker])
def list_workers() -> list[Worker]:
    return sorted(workers.values(), key=lambda item: item.created_at, reverse=True)
