import base64

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["speech"])

_STT_URL = "https://api.sarvam.ai/speech-to-text"
_TTS_URL = "https://api.sarvam.ai/text-to-speech"


def _sarvam_headers() -> dict:
    if not settings.sarvam_api_key:
        raise HTTPException(status_code=503, detail="Speech service not configured")
    return {"api-subscription-key": settings.sarvam_api_key}


@router.post("/speech/stt")
async def speech_to_text(file: UploadFile = File(...)):
    headers = _sarvam_headers()
    audio_bytes = await file.read()

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            _STT_URL,
            headers=headers,
            files={"file": (file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm")},
            data={"model": "saaras:v3", "language_code": "hi-IN"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"STT error: {resp.text[:200]}")

    data = resp.json()
    return {
        "transcript": data.get("transcript", ""),
        "language_code": data.get("language_code", "hi-IN"),
    }


class TtsRequest(BaseModel):
    text: str
    language: str = "hi-IN"


@router.post("/speech/tts")
async def text_to_speech(payload: TtsRequest):
    headers = _sarvam_headers()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _TTS_URL,
            headers={**headers, "Content-Type": "application/json"},
            json={
                "inputs": [payload.text],
                "target_language_code": payload.language,
                "speaker": "anushka",
                "model": "bulbul:v2",
                "enable_preprocessing": True,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TTS error: {resp.text[:200]}")

    data = resp.json()
    audios = data.get("audios", [])
    if not audios:
        raise HTTPException(status_code=502, detail="No audio returned from TTS")

    audio_bytes = base64.b64decode(audios[0])
    return Response(content=audio_bytes, media_type="audio/wav")
