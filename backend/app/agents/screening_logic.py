import json
import re
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
CALL_RUBRIC_WEIGHTS = {
    "machine_familiarity": 0.35,
    "technical_knowledge": 0.33,
    "fabric_material_knowledge": 0.20,
    "communication_confidence": 0.12,
}

TRADE_KEYWORDS = {
    "tailor": "Tailoring",
    "silai": "Tailoring",
    "stitching": "Tailoring",
    "carpenter": "Carpentry",
    "badhai": "Carpentry",
    "electrician": "Electrical Work",
    "bijli": "Electrical Work",
    "plumber": "Plumbing",
    "mason": "Masonry",
    "rajmistri": "Masonry",
    "welder": "Welding",
    "painter": "Painting",
}


def _get_openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


def _llm_available() -> bool:
    return bool(settings.azure_openai_endpoint and settings.azure_openai_api_key and settings.azure_openai_deployment)


def choose_opening_question(
    worker_name: str,
    assignment: str,
    interview_mode: str = "web",
    locale: str = "en",
) -> str:
    if interview_mode == "call":
        if locale == "hi":
            return (
                f"नमस्ते {worker_name}. यह Shramik.ai का फोन इंटरव्यू है। "
                f"आज हम इस काम के लिए बात करेंगे: {assignment.lower()}. "
                "सबसे पहले अपने काम का अनुभव और रोज़ का process सीधे शब्दों में बताइए।"
            )
        return (
            f"Hello {worker_name}. This is a Shramik.ai phone interview. "
            f"Today we will talk about this role: {assignment.lower()}. "
            "First, describe your work experience and daily process in simple words."
        )

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


def _fallback_turn(session: Session, worker_text: str, locale: str = "en") -> dict:
    phase_order = ["intro", "technical", "task", "passport"]
    current_index = phase_order.index(session.current_phase) if session.current_phase in phase_order else 0
    next_phase = phase_order[min(current_index + 1, len(phase_order) - 1)]
    lowered = worker_text.lower()
    score_delta = 1.5 if len(worker_text.split()) >= 8 else -1.0
    if any(term in lowered for term in ("machine", "needle", "tension", "dhaga", "motor", "wire", "pipe")):
        score_delta += 1.0

    if locale == "hi":
        follow_up = {
            "intro": "अपने काम में आप सबसे ज़्यादा कौन से tools या machines इस्तेमाल करते हैं?",
            "technical": "अगर काम में quality issue आए, तो आप उसे कैसे पहचानते और ठीक करते हैं?",
            "task": "अब step by step बताइए कि यह काम शुरू से खत्म तक कैसे करते हैं।",
            "passport": "धन्यवाद। आपका इंटरव्यू लगभग पूरा है। एक चीज़ बताइए जो आपको इस काम में सबसे अच्छी आती है।",
        }
    else:
        follow_up = {
            "intro": "Which tools or machines do you use the most in your work?",
            "technical": "If there is a quality issue in the job, how do you identify and fix it?",
            "task": "Now explain step by step how you do this job from start to finish.",
            "passport": "Thank you. Your interview is almost complete. Tell me one thing you do especially well in this work.",
        }
    rubric = {
        "intro": "communication_confidence",
        "technical": "technical_knowledge",
        "task": "machine_familiarity" if session.interview_mode == "call" else "stitch_quality",
        "passport": "fabric_material_knowledge",
    }
    return {
        "ai_reply": follow_up.get(next_phase, follow_up["passport"]),
        "rubric_tag": rubric.get(next_phase, "communication_confidence"),
        "phase": next_phase,
        "score_delta": max(-8.0, min(8.0, score_delta)),
    }


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

    if not _llm_available():
        return _fallback_turn(session, worker_text, locale)

    try:
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
    except Exception:
        return _fallback_turn(session, worker_text, locale)

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
    if image_data and _llm_available():
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

    if not _llm_available():
        return {}

    try:
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
        return json.loads(resp.choices[0].message.content)
    except (json.JSONDecodeError, AttributeError, Exception):
        return {}


def extract_worker_profile_from_text(transcript: str) -> dict:
    text = transcript.strip()
    if not text:
        return {"name": "Unknown Worker", "specialization": "General Worker", "experience_years": 0}

    if _llm_available():
        system = (
            "Extract worker onboarding details from Hindi or English speech. "
            "Return only JSON with keys: name, specialization, experience_years."
        )
        try:
            client = _get_openai_client()
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": text},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
            parsed = json.loads(resp.choices[0].message.content)
            return {
                "name": str(parsed.get("name") or "Unknown Worker").strip()[:80],
                "specialization": str(parsed.get("specialization") or "General Worker").strip()[:120],
                "experience_years": max(0, min(50, int(parsed.get("experience_years") or 0))),
            }
        except Exception:
            pass

    lowered = text.lower()
    experience_match = re.search(r"(\d{1,2})\s*(?:saal|year)", lowered)
    experience_years = int(experience_match.group(1)) if experience_match else 0

    name = "Unknown Worker"
    for pattern in (
        r"(?:mera naam|my name is|i am)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})",
        r"(?:main|mai)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})",
    ):
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            name = match.group(1).strip().title()
            break

    specialization = "General Worker"
    for keyword, label in TRADE_KEYWORDS.items():
        if keyword in lowered:
            specialization = label
            break

    return {
        "name": name[:80],
        "specialization": specialization[:120],
        "experience_years": experience_years,
    }


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
    if session.snapshot_feedback and session.interview_mode != "call":
        bonus = session.snapshot_feedback[-1].quality_score * 0.1
        rubric_raw["stitch_quality"] = min(100.0, round(rubric_raw["stitch_quality"] + bonus, 2))
    if session.interview_mode == "call":
        rubric_raw["stitch_quality"] = 0.0

    integrity_compliance = round(session.integrity_log.integrity_score * 100, 2)
    weights = CALL_RUBRIC_WEIGHTS if session.interview_mode == "call" else RUBRIC_WEIGHTS

    overall = round(
        sum(rubric_raw.get(k, 0.0) * w for k, w in weights.items()),
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
