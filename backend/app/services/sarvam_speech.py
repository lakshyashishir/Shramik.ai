import httpx
from fastapi import HTTPException

from app.config import settings

STT_URL = "https://api.sarvam.ai/speech-to-text"
TTS_URL = "https://api.sarvam.ai/text-to-speech"


def sarvam_headers() -> dict[str, str]:
    if not settings.sarvam_api_key:
        raise HTTPException(status_code=503, detail="Speech service not configured")
    return {"api-subscription-key": settings.sarvam_api_key}


async def transcribe_audio_bytes(
    audio_bytes: bytes,
    *,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    language_code: str = "hi-IN",
    timeout: int = 60,
) -> dict[str, str]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            STT_URL,
            headers=sarvam_headers(),
            files={"file": (filename, audio_bytes, content_type)},
            data={"model": "saaras:v3", "language_code": language_code},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"STT error: {resp.text[:200]}")

    data = resp.json()
    return {
        "transcript": str(data.get("transcript", "")).strip(),
        "language_code": str(data.get("language_code", language_code)),
    }

