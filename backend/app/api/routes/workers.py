import json
import re

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.screening_logic import _get_openai_client
from app.config import settings
from app.database import get_db
from app.models import Worker, WorkerCreate, new_id, utc_now_iso
from app.services import store

router = APIRouter(tags=["workers"])


def _extract_experience_years_fallback(text: str) -> int:
    lowered = text.lower()
    patterns = [
        r"(\d{1,2})\s*(?:years?|yrs?)",
        r"(\d{1,2})\s*(?:saal|sal)",
        r"experience\s*(?:is|:)?\s*(\d{1,2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, lowered)
        if match:
            try:
                return max(0, min(50, int(match.group(1))))
            except (TypeError, ValueError):
                continue
    return 0


class VoiceOnboardRequest(BaseModel):
    voice_transcript: str


@router.post("/workers", response_model=Worker)
async def create_worker(payload: WorkerCreate, db: AsyncSession = Depends(get_db)) -> Worker:
    worker = Worker(
        id=new_id("worker"),
        name=payload.name.strip(),
        specialization=payload.specialization.strip(),
        experience_years=int(payload.experience_years),
        created_at=utc_now_iso(),
    )
    await store.create_worker(db, worker)
    return worker


@router.get("/workers", response_model=list[Worker])
async def list_workers(db: AsyncSession = Depends(get_db)) -> list[Worker]:
    return await store.get_all_workers(db)


@router.post("/workers/onboard", response_model=Worker)
async def onboard_worker_by_voice(payload: VoiceOnboardRequest, db: AsyncSession = Depends(get_db)) -> Worker:
    """Extract worker info from a Hindi voice transcript using GPT and create a worker record."""
    transcript = payload.voice_transcript.strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="voice_transcript is empty")

    if not settings.azure_openai_api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    client = _get_openai_client()
    try:
        resp = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract worker registration info from a spoken Hindi/Hinglish transcript. "
                        "Return ONLY valid JSON with exactly these keys: "
                        "{\"name\": string, \"specialization\": string, \"experience_years\": int}. "
                        "Rules: "
                        "- name: the worker's full name as spoken (romanize if needed, e.g. 'Ramu Prasad'). "
                        "- specialization: their trade/skill in English (e.g. 'Tailor', 'Welder', 'Electrician', 'Carpenter'). "
                        "- experience_years: integer years of experience. Infer from transcript if spoken. "
                        "If any field is unclear, make a reasonable guess. Never return null."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Transcript: {transcript}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=120,
        )
        data = json.loads(resp.choices[0].message.content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {exc}") from exc

    name = str(data.get("name", "Worker")).strip() or "Worker"
    specialization = str(data.get("specialization", "General Labour")).strip() or "General Labour"
    try:
        experience_years = max(0, min(50, int(data.get("experience_years", 0))))
    except (TypeError, ValueError):
        experience_years = 0
    if experience_years == 0:
        experience_years = _extract_experience_years_fallback(transcript)

    worker = Worker(
        id=new_id("worker"),
        name=name,
        specialization=specialization,
        experience_years=experience_years,
        created_at=utc_now_iso(),
    )
    await store.create_worker(db, worker)
    return worker
