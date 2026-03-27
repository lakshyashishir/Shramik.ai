from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import JobDB
from app.models import Job, JobCreate, new_id, utc_now_iso

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
