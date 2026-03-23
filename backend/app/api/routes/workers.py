import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.screening_logic import _get_openai_client
from app.config import settings
from app.models import Worker, WorkerCreate, new_id, utc_now_iso
from app.services.store import workers

router = APIRouter(tags=["workers"])


class VoiceOnboardRequest(BaseModel):
    voice_transcript: str


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


@router.post("/workers/onboard", response_model=Worker)
def onboard_worker_by_voice(payload: VoiceOnboardRequest) -> Worker:
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
                        "- experience_years: integer years of experience (0 if not mentioned). "
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

    worker = Worker(
        id=new_id("worker"),
        name=name,
        specialization=specialization,
        experience_years=experience_years,
        created_at=utc_now_iso(),
    )
    workers[worker.id] = worker
    return worker
