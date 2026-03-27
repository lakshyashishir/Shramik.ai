from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Session, Worker, IntegrityLog
from app.db_models import WorkerDB, SessionDB


# Worker operations
async def create_worker(db: AsyncSession, worker: Worker) -> Worker:
    db_worker = WorkerDB(
        id=worker.id,
        name=worker.name,
        specialization=worker.specialization,
        experience_years=worker.experience_years,
        created_at=datetime.fromisoformat(worker.created_at.replace("Z", "+00:00")),
        phone_number=worker.phone_number,
    )
    db.add(db_worker)
    await db.commit()
    await db.refresh(db_worker)
    return worker


def _db_worker_to_model(db_worker: WorkerDB) -> Worker:
    return Worker(
        id=db_worker.id,
        name=db_worker.name,
        specialization=db_worker.specialization,
        experience_years=db_worker.experience_years,
        created_at=db_worker.created_at.isoformat(),
        phone_number=db_worker.phone_number,
    )


async def get_worker(db: AsyncSession, worker_id: str) -> Optional[Worker]:
    result = await db.execute(select(WorkerDB).where(WorkerDB.id == worker_id))
    db_worker = result.scalar_one_or_none()
    if db_worker is None:
        return None
    return _db_worker_to_model(db_worker)


async def get_worker_by_phone(db: AsyncSession, phone_number: str) -> Optional[Worker]:
    result = await db.execute(select(WorkerDB).where(WorkerDB.phone_number == phone_number))
    db_worker = result.scalar_one_or_none()
    if db_worker is None:
        return None
    return _db_worker_to_model(db_worker)


async def update_worker(db: AsyncSession, worker: Worker) -> Worker:
    result = await db.execute(select(WorkerDB).where(WorkerDB.id == worker.id))
    db_worker = result.scalar_one_or_none()
    if db_worker is None:
        return await create_worker(db, worker)
    db_worker.name = worker.name
    db_worker.specialization = worker.specialization
    db_worker.experience_years = worker.experience_years
    await db.commit()
    await db.refresh(db_worker)
    return worker


async def get_all_workers(db: AsyncSession) -> List[Worker]:
    result = await db.execute(select(WorkerDB).order_by(WorkerDB.created_at.desc()))
    db_workers = result.scalars().all()
    return [_db_worker_to_model(w) for w in db_workers]


# Session operations
async def create_session(db: AsyncSession, session: Session) -> Session:
    db_session = SessionDB(
        id=session.id,
        worker_id=session.worker_id,
        worker_name=session.worker_name,
        assignment=session.assignment,
        status=session.status,
        started_at=datetime.fromisoformat(session.started_at.replace("Z", "+00:00")),
        ended_at=datetime.fromisoformat(session.ended_at.replace("Z", "+00:00")) if session.ended_at else None,
        live_score=session.live_score,
        recommendation=session.recommendation,
        summary=session.summary,
        transcript=[t.model_dump() for t in session.transcript],
        snapshot_feedback=[s.model_dump() for s in session.snapshot_feedback],
        rubric_scores=session.rubric_scores,
        integrity_log=session.integrity_log.model_dump(),
        integrity_events=[e.model_dump() for e in session.integrity_events],
        current_phase=session.current_phase,
        self_ratings=session.self_ratings,
        external_call_id=session.external_call_id,
        external_call_status=session.external_call_status,
        interview_mode=session.interview_mode,
        call_phone_number=session.call_phone_number,
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return session


async def get_session(db: AsyncSession, session_id: str) -> Optional[Session]:
    result = await db.execute(select(SessionDB).where(SessionDB.id == session_id))
    db_session = result.scalar_one_or_none()
    if db_session is None:
        return None
    return _db_session_to_model(db_session)


async def get_all_sessions(db: AsyncSession) -> List[Session]:
    result = await db.execute(select(SessionDB).order_by(SessionDB.started_at.desc()))
    db_sessions = result.scalars().all()
    return [_db_session_to_model(s) for s in db_sessions]


async def update_session(db: AsyncSession, session: Session) -> Session:
    result = await db.execute(select(SessionDB).where(SessionDB.id == session.id))
    db_session = result.scalar_one_or_none()
    if db_session is None:
        return await create_session(db, session)

    db_session.status = session.status
    db_session.ended_at = datetime.fromisoformat(session.ended_at.replace("Z", "+00:00")) if session.ended_at else None
    db_session.live_score = session.live_score
    db_session.recommendation = session.recommendation
    db_session.summary = session.summary
    db_session.transcript = [t.model_dump() for t in session.transcript]
    db_session.snapshot_feedback = [s.model_dump() for s in session.snapshot_feedback]
    db_session.rubric_scores = session.rubric_scores
    db_session.integrity_log = session.integrity_log.model_dump()
    db_session.integrity_events = [e.model_dump() for e in session.integrity_events]
    db_session.current_phase = session.current_phase
    db_session.self_ratings = session.self_ratings
    if session.external_call_id is not None:
        db_session.external_call_id = session.external_call_id
    if session.external_call_status is not None:
        db_session.external_call_status = session.external_call_status

    await db.commit()
    await db.refresh(db_session)
    return session


def _db_session_to_model(db_session: SessionDB) -> Session:
    from app.models import TranscriptItem, SnapshotFeedback, IntegrityEvent

    return Session(
        id=db_session.id,
        worker_id=db_session.worker_id,
        worker_name=db_session.worker_name,
        assignment=db_session.assignment,
        status=db_session.status,
        started_at=db_session.started_at.isoformat(),
        ended_at=db_session.ended_at.isoformat() if db_session.ended_at else None,
        live_score=db_session.live_score,
        recommendation=db_session.recommendation,
        summary=db_session.summary,
        transcript=[TranscriptItem(**t) for t in (db_session.transcript or [])],
        snapshot_feedback=[SnapshotFeedback(**s) for s in (db_session.snapshot_feedback or [])],
        rubric_scores=db_session.rubric_scores or {},
        integrity_log=IntegrityLog(**(db_session.integrity_log or {})),
        integrity_events=[IntegrityEvent(**e) for e in (db_session.integrity_events or [])],
        current_phase=db_session.current_phase,
        self_ratings=db_session.self_ratings or {},
        external_call_id=db_session.external_call_id,
        external_call_status=db_session.external_call_status,
        interview_mode=db_session.interview_mode or "web",
        call_phone_number=db_session.call_phone_number,
    )


async def get_session_by_call_id(db: AsyncSession, call_id: str) -> Optional[Session]:
    result = await db.execute(select(SessionDB).where(SessionDB.external_call_id == call_id))
    db_session = result.scalar_one_or_none()
    if db_session is None:
        return None
    return _db_session_to_model(db_session)
