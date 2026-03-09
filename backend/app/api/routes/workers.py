from fastapi import APIRouter

from app.models import Worker, WorkerCreate, new_id, utc_now_iso
from app.services.store import workers

router = APIRouter(tags=["workers"])


@router.post("/workers", response_model=Worker)
def create_worker(payload: WorkerCreate) -> Worker:
    worker = Worker(
        id=new_id("worker"),
        name=payload.name.strip(),
        specialization=payload.specialization.strip(),
        experience_years=int(payload.experience_years),
        created_at=utc_now_iso(),
    )
    workers[worker.id] = worker
    return worker


@router.get("/workers", response_model=list[Worker])
def list_workers() -> list[Worker]:
    return sorted(workers.values(), key=lambda item: item.created_at, reverse=True)
