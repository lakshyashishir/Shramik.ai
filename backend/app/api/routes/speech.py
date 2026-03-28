import base64
import hashlib

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.sarvam_speech import TTS_URL, sarvam_headers, transcribe_audio_bytes

router = APIRouter(tags=["speech"])

# In-memory TTS cache: (text, language) hash -> WAV bytes
_tts_cache: dict[str, bytes] = {}

@router.post("/speech/stt")
async def speech_to_text(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    return await transcribe_audio_bytes(
        audio_bytes,
        filename=file.filename or "audio.webm",
        content_type=file.content_type or "audio/webm",
        language_code="hi-IN",
    )


class TtsRequest(BaseModel):
    text: str
    language: str = "hi-IN"


@router.post("/speech/tts")
async def text_to_speech(payload: TtsRequest):
    cache_key = hashlib.md5(f"{payload.text}|{payload.language}".encode()).hexdigest()
    if cache_key in _tts_cache:
        return Response(content=_tts_cache[cache_key], media_type="audio/wav")

    headers = sarvam_headers()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TTS_URL,
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
    _tts_cache[cache_key] = audio_bytes
    return Response(content=audio_bytes, media_type="audio/wav")
