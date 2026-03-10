"""
Shramik.ai – Screening Logic
Uses Azure OpenAI GPT-4.1 for dynamic bilingual interview turns and final scoring.
Falls back to hardcoded questions if the LLM is unavailable.
"""
from __future__ import annotations

import json
import logging

from openai import AzureOpenAI

from app.config import settings
from app.models import Session, SnapshotFeedback, utc_now_iso

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Azure OpenAI client (lazy – only used if key is present)
# ---------------------------------------------------------------------------
_client: AzureOpenAI | None = None


def _get_client() -> AzureOpenAI | None:
    global _client
    if _client is not None:
        return _client
    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        return None
    _client = AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )
    return _client


def _call_llm(system: str, user: str, fallback: dict) -> dict:
    client = _get_client()
    if client is None:
        return fallback
    try:
        resp = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=400,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or ""
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else fallback
    except Exception as exc:
        logger.warning("LLM call failed: %s", exc)
        return fallback


# ---------------------------------------------------------------------------
# Fallback question banks (used when LLM is unavailable)
# ---------------------------------------------------------------------------
_OPENING_FALLBACK_EN = (
    "Hi {name}! I'm Shram AI, your screening interviewer today. "
    "Let's start simple — how many years have you been working as a tailor, "
    "and what type of garments do you mostly stitch?"
)
_OPENING_FALLBACK_HI = (
    "नमस्ते {name}! मैं Shram AI हूँ, आज आपका इंटरव्यू लेने वाला। "
    "चलिए शुरू करते हैं — आप कितने सालों से सिलाई कर रहे हैं, "
    "और आप ज़्यादातर किस तरह के कपड़े सिलते हैं?"
)

_TURN_FALLBACK = [
    ("If you notice skipped stitches during production, what would you check first?",
     "Good. Explain both machine tension and needle inspection.", 3.0),
    ("How do you handle fabric edge finishing when material starts fraying?",
     "Mention edge finishing technique and rework prevention.", 2.5),
    ("What do you do if the supervisor asks you to increase speed without losing quality?",
     "Strong answers balance speed with repeatable quality checks.", 2.0),
    ("Describe how you set up your machine before starting a new stitch assignment.",
     "Look for threading sequence and tension setup knowledge.", 3.0),
    ("What quality checks do you do before handing over a finished piece?",
     "Seam alignment, edge finish, and measurement checks are key.", 2.5),
]

_TURN_FALLBACK_HI = [
    ("अगर सिलाई के दौरान टाँके छूट जाएँ, तो आप पहले क्या चेक करेंगे?",
     "मशीन टेंशन और सुई दोनों की जाँच करें।", 3.0),
    ("जब कपड़े का किनारा उधड़ने लगे तो आप क्या करते हैं?",
     "एज फिनिशिंग तकनीक और रिवर्क रोकना बताएं।", 2.5),
    ("अगर सुपरवाइज़र कहे कि स्पीड बढ़ाओ पर क्वालिटी न गिरे, तो आप क्या करेंगे?",
     "स्पीड और क्वालिटी का बैलेंस महत्वपूर्ण है।", 2.0),
    ("नया काम शुरू करने से पहले आप मशीन कैसे सेट करते हैं?",
     "थ्रेडिंग और टेंशन सेटअप की जानकारी देखें।", 3.0),
    ("पीस हैंडओवर से पहले आप कौन-कौन से क्वालिटी चेक करते हैं?",
     "सीम अलाइनमेंट, किनारा, और माप सही होने चाहिए।", 2.5),
]


# ---------------------------------------------------------------------------
# Opening question
# ---------------------------------------------------------------------------
def choose_opening_question(worker_name: str, assignment: str, locale: str = "en") -> str:
    is_hindi = locale == "hi"

    system = (
        "You are Shram AI, a warm and professional bilingual (Hindi + English) "
        "AI interviewer for garment worker skill screening. "
        "Your task: generate a friendly, natural opening question to start the interview. "
        "Language: HINDI. Use simple, everyday Hindi (not formal/Sanskritised). "
        "You may mix in a few English technical words (like 'machine', 'stitch', 'seam'). "
        "Ask about experience years AND garment specialization in ONE question. "
        "Return ONLY strict JSON: {\"question\": \"...\"}"
        if is_hindi else
        "You are Shram AI, a warm and professional AI interviewer for garment worker skill screening. "
        "Generate a friendly, natural opening question to start the interview in English. "
        "Ask about experience years AND garment specialization in ONE question. "
        "Return ONLY strict JSON: {\"question\": \"...\"}"
    )

    prompt = (
        f"Worker name: {worker_name}\n"
        f"Assignment context: {assignment}\n"
        "Generate the opening question."
    )

    fallback_text = (
        _OPENING_FALLBACK_HI.format(name=worker_name)
        if is_hindi
        else _OPENING_FALLBACK_EN.format(name=worker_name)
    )

    result = _call_llm(system, prompt, {"question": fallback_text})
    return str(result.get("question", fallback_text))


# ---------------------------------------------------------------------------
# Turn (dynamic next question)
# ---------------------------------------------------------------------------
def next_turn_ai(
    session: Session,
    worker_text: str,
    locale: str = "en",
) -> tuple[str, str, float]:
    """Return (ai_question, coach_note, score_delta)."""
    is_hindi = locale == "hi"
    turn_index = sum(1 for t in session.transcript if t.speaker == "worker")

    # Build transcript summary (last 6 exchanges)
    recent = session.transcript[-6:]
    transcript_text = "\n".join(
        f"{'AI' if t.speaker == 'ai' else 'Worker'}: {t.text}"
        for t in recent
    )

    system = (
        "You are Shram AI, a bilingual (Hindi + English) AI interviewer screening garment/tailoring workers. "
        "Based on the conversation so far, ask the NEXT most useful question to assess skill. "
        "Use HINDI (Hinglish is fine — mix common English technical words). "
        "Cover these areas across the interview in order: "
        "Phase 1 (turns 1-2): machine familiarity and setup; "
        "Phase 2 (turns 3-5): defect diagnosis, stitch quality, material knowledge; "
        "Phase 3 (turns 6+): speed readiness, quality checks, work habits. "
        "Keep question SHORT (under 25 words). One question only — no commentary. "
        "score_delta: how much this answer deserves (+2 to +8 = good, -4 to 0 = weak/unclear). "
        "Return ONLY strict JSON: {\"question\": \"...\", \"coach_note\": \"...\", \"score_delta\": number}"
        if is_hindi else
        "You are Shram AI, an AI interviewer screening garment/tailoring workers. "
        "Based on the conversation so far, ask the NEXT most useful question to assess skill. "
        "Use English. "
        "Cover these areas across the interview in order: "
        "Phase 1 (turns 1-2): machine familiarity and setup; "
        "Phase 2 (turns 3-5): defect diagnosis, stitch quality, material knowledge; "
        "Phase 3 (turns 6+): speed readiness, quality checks, work habits. "
        "Keep question SHORT (under 25 words). One question only. "
        "score_delta: how much this answer deserves (+2 to +8 = good, -4 to 0 = weak/unclear). "
        "Return ONLY strict JSON: {\"question\": \"...\", \"coach_note\": \"...\", \"score_delta\": number}"
    )

    prompt = (
        f"Worker: {session.worker_name} | Specialization: {session.assignment}\n"
        f"Turn number: {turn_index + 1}\n"
        f"Current live score: {session.live_score:.1f}/100\n"
        f"Latest transcript:\n{transcript_text}\n"
        f"Worker just said: {worker_text}\n"
        "Generate the next question."
    )

    fallback_bank = _TURN_FALLBACK_HI if is_hindi else _TURN_FALLBACK
    q, note, delta = fallback_bank[turn_index % len(fallback_bank)]
    fallback = {"question": q, "coach_note": note, "score_delta": delta}

    result = _call_llm(system, prompt, fallback)

    question = str(result.get("question", q))
    coach_note = str(result.get("coach_note", note))
    try:
        raw_delta = float(result.get("score_delta", delta))
        score_delta = max(-8.0, min(8.0, raw_delta))
    except (TypeError, ValueError):
        score_delta = float(delta)

    return question, coach_note, score_delta


# ---------------------------------------------------------------------------
# Snapshot feedback (unchanged — vision-based, formula-driven for now)
# ---------------------------------------------------------------------------
def build_snapshot_feedback(note: str, current_score: float) -> SnapshotFeedback:
    quality_score = min(92.0, max(58.0, round(current_score + 6.0, 2)))
    focus_areas = ["seam straightness", "edge finishing"]
    if "collar" in note.lower() or "curve" in note.lower():
        focus_areas = ["curve control", "seam consistency"]

    return SnapshotFeedback(
        captured_at=utc_now_iso(),
        quality_score=quality_score,
        feedback="Stitch line looks promising. Improve consistency and finishing neatness for production readiness.",
        focus_areas=focus_areas,
        note=note,
    )


# ---------------------------------------------------------------------------
# Finalize session — AI-powered rubric scoring
# ---------------------------------------------------------------------------
def finalize_session(session: Session, locale: str = "en") -> Session:
    is_hindi = locale == "hi"

    transcript_text = "\n".join(
        f"{'AI' if t.speaker == 'ai' else 'Worker'}: {t.text}"
        for t in session.transcript
    )

    system = (
        "You are Shram AI evaluator. Analyze the full interview transcript of a garment/tailoring worker "
        "and produce a fair, evidence-based rubric score. "
        "Each rubric score must be 0-100 (integer). "
        "recommendation must be exactly one of: 'pass', 'hold', or 'reject'. "
        "overall_comment should be 1-2 sentences, written in simple Hindi. "
        "Return ONLY strict JSON with these exact keys: "
        "{\"machine_familiarity\": int, \"technical_knowledge\": int, \"stitch_quality\": int, "
        "\"speed_readiness\": int, \"communication\": int, "
        "\"overall_comment\": \"...\", \"recommendation\": \"pass|hold|reject\"}"
        if is_hindi else
        "You are Shram AI evaluator. Analyze the full interview transcript of a garment/tailoring worker "
        "and produce a fair, evidence-based rubric score. "
        "Each rubric score must be 0-100 (integer). "
        "recommendation must be exactly one of: 'pass', 'hold', or 'reject'. "
        "overall_comment should be 1-2 sentences in English. "
        "Return ONLY strict JSON with these exact keys: "
        "{\"machine_familiarity\": int, \"technical_knowledge\": int, \"stitch_quality\": int, "
        "\"speed_readiness\": int, \"communication\": int, "
        "\"overall_comment\": \"...\", \"recommendation\": \"pass|hold|reject\"}"
    )

    prompt = (
        f"Worker: {session.worker_name}\n"
        f"Assignment: {session.assignment}\n"
        f"Full interview transcript:\n{transcript_text}\n"
        "Evaluate and score."
    )

    fallback = {
        "machine_familiarity": 68,
        "technical_knowledge": 72,
        "stitch_quality": 70,
        "speed_readiness": 65,
        "communication": 75,
        "overall_comment": (
            "Worker shows solid tailoring basics and can be considered for supervised line work."
        ),
        "recommendation": "hold",
    }

    result = _call_llm(system, prompt, fallback)

    rubric_keys = ["machine_familiarity", "technical_knowledge", "stitch_quality", "speed_readiness", "communication"]
    rubric_scores: dict[str, float] = {}
    for key in rubric_keys:
        try:
            rubric_scores[key] = float(max(0, min(100, int(result.get(key, fallback[key])))))
        except (TypeError, ValueError):
            rubric_scores[key] = float(fallback[key])

    # Blend AI rubric average with snapshot bonus
    snapshot_bonus = 0.0
    if session.snapshot_feedback:
        snapshot_bonus = session.snapshot_feedback[-1].quality_score * 0.1

    overall = round(sum(rubric_scores.values()) / len(rubric_scores) + snapshot_bonus, 2)
    overall = max(0.0, min(100.0, overall))

    # Integrity override
    integrity_score = round(session.integrity_log.integrity_score * 100, 2)
    rubric_scores["integrity_compliance"] = integrity_score

    recommendation = str(result.get("recommendation", fallback["recommendation"])).lower().strip()
    if recommendation not in {"pass", "hold", "reject"}:
        recommendation = "hold"

    if session.integrity_log.overall_flag == "critical_flag":
        recommendation = "reject"
        summary = "Face identity changed during interview. Recruiter verification required before proceeding."
    else:
        summary = str(result.get("overall_comment", fallback["overall_comment"]))

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
