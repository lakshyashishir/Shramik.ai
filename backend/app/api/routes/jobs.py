from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.db_models import JobDB, JobApplicationDB, WorkerRatingDB
from app.models import (
    Job, JobCreate, new_id, utc_now_iso,
    JobApplyRequest, JobApplyResponse,
    WorkerRatingRequest, WorkerRatingResponse,
)

router = APIRouter(tags=["jobs"])


def _to_model(db_job: JobDB) -> Job:
    return Job(
        id=db_job.id,
        title=db_job.title,
        budget=db_job.budget,
        skill=db_job.skill,
        description=db_job.description or "",
        urgent=db_job.urgent,
        location=db_job.location or "",
        posted_at=db_job.posted_at.isoformat(),
    )


@router.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)) -> list[Job]:
    result = await db.execute(select(JobDB).order_by(JobDB.posted_at.desc()))
    return [_to_model(j) for j in result.scalars().all()]


@router.post("/jobs", status_code=201)
async def create_job(payload: JobCreate, db: AsyncSession = Depends(get_db)) -> Job:
    db_job = JobDB(
        id=new_id("job"),
        title=payload.title,
        budget=payload.budget,
        skill=payload.skill,
        description=payload.description,
        urgent=payload.urgent,
        location=payload.location,
    )
    db.add(db_job)
    await db.commit()
    await db.refresh(db_job)
    return _to_model(db_job)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JobDB).where(JobDB.id == job_id))
    db_job = result.scalar_one_or_none()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(db_job)
    await db.commit()


@router.post("/jobs/{job_id}/apply", response_model=JobApplyResponse, status_code=201)
async def apply_to_job(
    job_id: str,
    payload: JobApplyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobDB).where(JobDB.id == job_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    application = JobApplicationDB(
        id=new_id("app"),
        job_id=job_id,
        worker_id=payload.worker_id,
        passport_tier=payload.passport_tier,
        karma_score=payload.karma_score,
        status="applied",
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return JobApplyResponse(
        application_id=application.id,
        job_id=job_id,
        worker_id=payload.worker_id,
        status=application.status,
        applied_at=application.applied_at.isoformat(),
    )


@router.post("/jobs/{job_id}/rate", response_model=WorkerRatingResponse, status_code=201)
async def rate_worker(
    job_id: str,
    payload: WorkerRatingRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobDB).where(JobDB.id == job_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    rating_row = WorkerRatingDB(
        id=new_id("rating"),
        worker_id=payload.worker_id,
        job_id=job_id,
        rating=payload.rating,
        tags=",".join(payload.tags) if payload.tags else None,
        note=payload.note,
        rated_by=payload.rated_by,
    )
    db.add(rating_row)
    await db.commit()
    await db.refresh(rating_row)

    return WorkerRatingResponse(
        rating_id=rating_row.id,
        job_id=job_id,
        worker_id=payload.worker_id,
        rating=payload.rating,
        rated_by=payload.rated_by,
        rated_at=rating_row.rated_at.isoformat(),
    )


class HireRequest(BaseModel):
    worker_id: str
    recruiter_name: str = Field(..., min_length=2, max_length=120)
    note: Optional[str] = Field(None, max_length=400)


class HireResponse(BaseModel):
    hire_id: str
    job_id: str
    worker_id: str
    recruiter_name: str
    status: str
    hired_at: str


@router.post("/jobs/{job_id}/hire", response_model=HireResponse, status_code=201)
async def hire_worker(
    job_id: str,
    payload: HireRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recruiter clicks "Hire Now" on a worker's passport card.

    Records the hire intent against the job listing. No middleman. No thekedar.
    Returns a hire confirmation with a unique hire_id.
    """
    result = await db.execute(select(JobDB).where(JobDB.id == job_id))
    db_job = result.scalar_one_or_none()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")

    hire_id = new_id("hire")
    hired_at = utc_now_iso()

    return HireResponse(
        hire_id=hire_id,
        job_id=job_id,
        worker_id=payload.worker_id,
        recruiter_name=payload.recruiter_name,
        status="hire_requested",
        hired_at=hired_at,
    )
