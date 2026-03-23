import json
from pathlib import Path

from openai import AzureOpenAI

from app.config import settings
from app.models import Session, SnapshotFeedback, utc_now_iso

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "interview-system.md"

RUBRIC_WEIGHTS = {
    "stitch_quality": 0.32,
    "machine_familiarity": 0.26,
    "technical_knowledge": 0.24,
    "fabric_material_knowledge": 0.12,
    "communication_confidence": 0.06,
}


def _get_openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


def choose_opening_question(worker_name: str, assignment: str, locale: str = "en") -> str:
    if locale == "hi":
        return (
            f"नमस्ते {worker_name}! श्रमिक.ai स्क्रीनिंग में आपका स्वागत है। "
            f"आज का असाइनमेंट है: {assignment}। "
            "पहले, अपने बारे में बताइए — आप कहाँ से हैं, "
            "और कितने सालों से सिलाई-कढ़ाई का काम कर रहे हैं?"
        )
    return (
        f"Hello {worker_name}! Welcome to Shramik.ai screening. "
        f"Today's assignment is: {assignment}. "
        "First, tell us a bit about yourself — where are you from, "
        "and how many years have you been doing tailoring or stitching work?"
    )


_HINDI_DIRECTIVE = (
    "\n\n## LANGUAGE OVERRIDE — STRICT\n"
    "The user has selected Hindi. You MUST reply ONLY in Hindi using Devanagari script. "
    "Do NOT use Roman/English script for any Hindi word. English technical terms (machine, stitch, seam, etc.) "
    "may be kept in English when there is no common Hindi equivalent, but all sentence structure, "
    "grammar, and explanations must be in Devanagari Hindi."
)

_ENGLISH_DIRECTIVE = (
    "\n\n## LANGUAGE OVERRIDE — STRICT\n"
    "The user has selected English. You MUST reply ONLY in English. "
    "Do not mix in Hindi or Hinglish."
)


def run_agent_turn(session: Session, worker_text: str, locale: str = "en") -> dict:
    """Call GPT-4o with full conversation history.
    Returns ai_reply, rubric_tag, phase, score_delta."""
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    system_prompt += _HINDI_DIRECTIVE if locale == "hi" else _ENGLISH_DIRECTIVE

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for item in session.transcript:
        role = "assistant" if item.speaker == "ai" else "user"
        messages.append({"role": role, "content": item.text})
    messages.append({"role": "user", "content": worker_text})

    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    raw = resp.choices[0].message.content
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

    try:
        score_delta = float(result.get("score_delta", 0))
        score_delta = max(-8.0, min(8.0, score_delta))
    except (TypeError, ValueError):
        score_delta = 0.0

    fallback = "समझ नहीं आया, कृपया दोबारा बोलें।" if locale == "hi" else "I didn't understand, please say that again."
    return {
        "ai_reply": result.get("reply", fallback),
        "rubric_tag": result.get("rubric_tag"),
        "phase": result.get("phase", session.current_phase),
        "score_delta": score_delta,
    }


def build_snapshot_feedback(note: str, current_score: float, image_data: str = "") -> SnapshotFeedback:
    """Analyze snapshot image with GPT-4o vision. Falls back to formula if no image."""
    if image_data:
        try:
            client = _get_openai_client()
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data, "detail": "low"},
                        },
                        {
                            "type": "text",
                            "text": (
                                "You are evaluating a garment worker's stitching task photo. "
                                f"Context note from supervisor: '{note}'. "
                                "Score the visible stitch/hem quality 0-100 (be strict: "
                                "poor finishing = below 50, neat and consistent = 70-85, excellent = 85+). "
                                "Return ONLY JSON: {\"quality_score\": int, \"feedback\": \"1 sentence\", "
                                "\"focus_areas\": [\"area1\", \"area2\"]}"
                            ),
                        },
                    ],
                }],
                response_format={"type": "json_object"},
                max_tokens=200,
            )
            data = json.loads(resp.choices[0].message.content)
            quality_score = float(max(0, min(100, int(data.get("quality_score", 60)))))
            feedback = str(data.get("feedback", ""))
            focus_areas = data.get("focus_areas", ["seam straightness", "edge finishing"])
            if not isinstance(focus_areas, list) or not focus_areas:
                focus_areas = ["seam straightness", "edge finishing"]
            return SnapshotFeedback(
                captured_at=utc_now_iso(),
                quality_score=quality_score,
                feedback=feedback,
                focus_areas=focus_areas[:3],
                note=note,
            )
        except Exception:
            pass  # fall through to formula fallback

    # Formula fallback (no image or vision call failed)
    quality_score = round(min(85.0, max(30.0, current_score + 5.0)), 2)
    focus_areas = ["seam straightness", "edge finishing"]
    if "collar" in note.lower() or "curve" in note.lower():
        focus_areas = ["curve control", "seam consistency"]
    return SnapshotFeedback(
        captured_at=utc_now_iso(),
        quality_score=quality_score,
        feedback="Image not available for analysis. Score estimated from session progress.",
        focus_areas=focus_areas,
        note=note,
    )


def _evaluate_transcript(session: Session, locale: str = "en") -> dict:
    """GPT-4o evaluates the full transcript and returns per-rubric scores 0-100."""
    transcript_text = "\n".join(
        f"{'AI' if t.speaker == 'ai' else 'Worker'}: {t.text}"
        for t in session.transcript
        if t.speaker in ("ai", "worker")
    )

    if not transcript_text.strip():
        return {}

    lang_note = (
        " Write the 'summary' field in Hindi (Devanagari script only, no Roman/English words for Hindi content)."
        if locale == "hi" else
        " Write the 'summary' field in English."
    )
    system = (
        "You are Shramik.ai evaluator for garment worker skill screening. "
        "Analyze the full interview transcript and score the worker strictly on each rubric 0-100. "
        "Scoring guide: below 40 = poor/no knowledge, 40-60 = basic, 61-75 = competent, 76-90 = strong, 91+ = expert. "
        "A worker giving vague or one-word answers should score 20-40, not 60+. "
        "Return ONLY JSON with these exact keys: "
        "{\"machine_familiarity\": int, \"technical_knowledge\": int, "
        "\"stitch_quality\": int, \"fabric_material_knowledge\": int, "
        "\"communication_confidence\": int, "
        "\"summary\": \"2 honest sentences about this worker's readiness\", "
        "\"recommendation\": \"pass|hold|reject\"}" + lang_note
    )

    prompt = (
        f"Worker: {session.worker_name}\n"
        f"Assignment: {session.assignment}\n\n"
        f"Full transcript:\n{transcript_text}\n\n"
        "Evaluate strictly. Do not inflate scores."
    )

    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    try:
        return json.loads(resp.choices[0].message.content)
    except (json.JSONDecodeError, AttributeError):
        return {}


def finalize_session(session: Session, locale: str = "en") -> Session:
    # GPT-4o evaluates the actual transcript content
    eval_result = _evaluate_transcript(session, locale)

    rubric_keys = ["machine_familiarity", "technical_knowledge", "stitch_quality",
                   "fabric_material_knowledge", "communication_confidence"]
    fallback_score = round(max(0.0, min(100.0, session.live_score)), 2)

    rubric_raw: dict[str, float] = {}
    for key in rubric_keys:
        try:
            rubric_raw[key] = float(max(0, min(100, int(eval_result.get(key, fallback_score)))))
        except (TypeError, ValueError):
            rubric_raw[key] = fallback_score

    # Snapshot bonus applied to stitch_quality
    if session.snapshot_feedback:
        bonus = session.snapshot_feedback[-1].quality_score * 0.1
        rubric_raw["stitch_quality"] = min(100.0, round(rubric_raw["stitch_quality"] + bonus, 2))

    integrity_compliance = round(session.integrity_log.integrity_score * 100, 2)

    overall = round(
        sum(rubric_raw[k] * w for k, w in RUBRIC_WEIGHTS.items()),
        2,
    )
    # Blend with integrity
    overall = round(overall * 0.94 + integrity_compliance * 0.06, 2)

    rubric_scores = {**rubric_raw, "integrity_compliance": integrity_compliance}

    if session.integrity_log.overall_flag == "critical_flag":
        recommendation = "reject"
        summary = (
            "इंटरव्यू के दौरान चेहरा बदल गया। आगे बढ़ने से पहले भर्तीकर्ता सत्यापन आवश्यक है।"
            if locale == "hi" else
            "Face identity changed during interview. Recruiter verification required before proceeding."
        )
    else:
        llm_rec = str(eval_result.get("recommendation", "")).lower().strip()
        recommendation = llm_rec if llm_rec in {"pass", "hold", "reject"} else (
            "pass" if overall >= 75 else "hold" if overall >= 50 else "reject"
        )
        if locale == "hi":
            fallback_summaries = {
                "pass": "श्रमिक ने मज़बूत सिलाई कौशल दिखाया और पर्यवेक्षित लाइन कार्य के लिए उपयुक्त है।",
                "hold": "श्रमिक में संभावना है, लेकिन तैनाती से पहले करीबी पर्यवेक्षण की ज़रूरत है।",
                "reject": "श्रमिक ने इस भूमिका के लिए पर्याप्त तकनीकी ज्ञान नहीं दिखाया।",
            }
        else:
            fallback_summaries = {
                "pass": "Worker shows strong tailoring fundamentals and can be considered for supervised line work.",
                "hold": "Worker shows promise but needs closer supervision before deployment.",
                "reject": "Worker did not demonstrate sufficient technical knowledge for this role.",
            }
        summary = str(eval_result.get("summary", "")) or fallback_summaries[recommendation]

    return session.model_copy(
        update={
            "status": "completed",
            "ended_at": utc_now_iso(),
            "live_score": overall,
            "recommendation": recommendation,
            "summary": summary,
            "rubric_scores": rubric_scores,
        }
    )
