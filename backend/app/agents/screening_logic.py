from app.models import Session, SnapshotFeedback, utc_now_iso

OPENING_QUESTIONS = [
    "Walk me through how you would set up your machine before starting a straight seam.",
    "How do you check seam allowance and stitch consistency before handing over a piece?",
    "Describe the first quality checks you do after finishing a stitching assignment.",
]

TURN_LIBRARY = [
    (
        "If you notice skipped stitches during production, what would you check first?",
        "Good. Explain both machine tension and needle inspection.",
        3.0,
    ),
    (
        "How do you handle fabric edge finishing when the material starts fraying?",
        "Mention edge finishing, handling technique, and rework prevention.",
        2.5,
    ),
    (
        "What would you do if the supervisor asks you to increase speed without losing quality?",
        "Strong answers balance speed with repeatable quality checks.",
        2.0,
    ),
]


def choose_opening_question(worker_name: str, assignment: str) -> str:
    return f"Hi {worker_name}, for this assignment, {assignment.lower()}"


def next_turn(turn_index: int) -> tuple[str, str, float]:
    return TURN_LIBRARY[turn_index % len(TURN_LIBRARY)]


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


def finalize_session(session: Session) -> Session:
    snapshot_bonus = 0.0
    if session.snapshot_feedback:
        snapshot_bonus = session.snapshot_feedback[-1].quality_score * 0.15

    technical_precision = min(95.0, round(session.live_score + snapshot_bonus * 0.2, 2))
    seam_quality_reasoning = min(92.0, round(session.live_score + snapshot_bonus * 0.15, 2))
    communication = min(90.0, round(session.live_score + 4.0, 2))
    speed_readiness = min(88.0, round(session.live_score + 2.0, 2))
    instruction_following = min(91.0, round(session.live_score + 3.0, 2))
    integrity_compliance = round(session.integrity_log.integrity_score * 100, 2)

    rubric = {
        "technical_precision": technical_precision,
        "seam_quality_reasoning": seam_quality_reasoning,
        "communication": communication,
        "speed_readiness": speed_readiness,
        "instruction_following": instruction_following,
        "integrity_compliance": integrity_compliance,
    }
    overall = round(sum(rubric.values()) / len(rubric), 2)
    if session.integrity_log.overall_flag == "critical_flag":
        recommendation = "reject"
        summary = "Face identity changed during interview. Recruiter verification is required before proceeding."
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
            "rubric_scores": rubric,
        }
    )
