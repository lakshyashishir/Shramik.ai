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


def choose_opening_question(worker_name: str, assignment: str) -> str:
    return (
        f"Namaste {worker_name}! Shramik.ai screening mein aapka swagat hai. "
        f"Aaj ka assignment hai: {assignment.lower()}. "
        "Pehle, aap apne baare mein thoda batayein — aap kahaan se hain, "
        "aur kitne saalon se silai-kadhai ka kaam kar rahe hain?"
    )


def run_agent_turn(session: Session, worker_text: str) -> dict:
    """Call GPT-4o with full conversation history. Returns ai_reply, rubric_tag, phase."""
    system_prompt = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

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

    return {
        "ai_reply": result.get("reply", "Samajh nahi aaya, kripya dobara bolein."),
        "rubric_tag": result.get("rubric_tag"),
        "phase": result.get("phase", session.current_phase),
    }


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


def _rubric_score_from_transcript(session: Session) -> dict[str, float]:
    """Compute per-rubric score as average acoustic_confidence (×100) for tagged turns."""
    buckets: dict[str, list[float]] = {k: [] for k in RUBRIC_WEIGHTS}

    for item in session.transcript:
        tag = item.rubric_tag
        if tag and tag in buckets and item.acoustic_confidence is not None:
            buckets[tag].append(item.acoustic_confidence * 100)

    return {
        tag: round(sum(vals) / len(vals), 2) if vals else round(session.live_score, 2)
        for tag, vals in buckets.items()
    }


def finalize_session(session: Session) -> Session:
    snapshot_bonus = 0.0
    if session.snapshot_feedback:
        snapshot_bonus = session.snapshot_feedback[-1].quality_score * 0.1

    rubric_raw = _rubric_score_from_transcript(session)
    rubric_raw["stitch_quality"] = min(
        100.0,
        round(rubric_raw["stitch_quality"] + snapshot_bonus, 2),
    )

    integrity_compliance = round(session.integrity_log.integrity_score * 100, 2)

    overall = round(
        sum(rubric_raw[k] * w for k, w in RUBRIC_WEIGHTS.items()),
        2,
    )
    overall = round(overall * 0.94 + integrity_compliance * 0.06, 2)

    rubric_scores = {**rubric_raw, "integrity_compliance": integrity_compliance}

    if session.integrity_log.overall_flag == "critical_flag":
        recommendation = "reject"
        summary = "Face identity changed during interview. Recruiter verification required before proceeding."
    else:
        recommendation = "pass" if overall >= 75 else "hold"
        summary = (
            "Worker shows strong tailoring fundamentals and can be considered for supervised line work."
            if recommendation == "pass"
            else "Worker shows promise but needs closer supervision before deployment."
        )

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
