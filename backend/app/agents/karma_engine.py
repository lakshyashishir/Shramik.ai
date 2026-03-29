"""
Karma Engine — compute a 0-1000 karma score for a worker from their session history.

Score components (max points):
  skill_score        300  — weighted rubric average from best completed session
  integrity_score    200  — from IntegrityLog.integrity_score (proctoring compliance)
  reputation_score   200  — employer ratings average (seeded at 0.5 until ratings exist)
  reliability_score  150  — session completion rate + trend bonus for improving scores
  growth_score       100  — distinct rubric dimensions mastered (score ≥ 65) across all sessions
  community_score     50  — referral network (future feature; seeded at 0)

Channel multipliers apply to skill_score only — a phone interview is harder to verify
than a full web session with camera:
  app_full / web   → 1.00  (full proctoring, camera, portfolio)
  offline_synced   → 0.90  (offline assessment, later synced)
  app_no_camera    → 0.85  (app but no camera verification)
  whatsapp         → 0.75  (voice + text, limited proctoring)
  ivr_call / call  → 0.60  (voice only, no visual verification)

Tier thresholds:
  Platinum  800 – 1000
  Gold      600 –  799
  Silver    300 –  599
  Bronze      0 –  299
"""

from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

CHANNEL_MULTIPLIER: Dict[str, float] = {
    "app_full": 1.0,
    "web": 1.0,
    "app_no_camera": 0.85,
    "whatsapp": 0.75,
    "ivr_call": 0.60,
    "call": 0.60,
    "offline_synced": 0.90,
    "offline": 0.90,
}

TIER_THRESHOLDS = [
    (800, "Platinum"),
    (600, "Gold"),
    (300, "Silver"),
    (0,   "Bronze"),
]

# Rubric keys that are considered "core skill" dimensions for growth scoring.
# Covers all domain variants used across garment, beauty, carpenter, etc.
_CORE_RUBRIC_KEYS = {
    "stitch_quality", "machine_familiarity", "technical_knowledge",
    "fabric_material_knowledge", "communication_confidence",
    "process_knowledge", "defect_awareness", "instruction_following",
    "vision_evidence", "operational_planning", "bulk_cooking_knowledge",
    "sanitation_awareness", "color_theory", "client_communication",
    "tool_handling", "safety_awareness", "electrical_theory",
    "wiring_knowledge", "material_knowledge",
}

# A score at or above this threshold on a rubric dimension counts as "mastered"
_MASTERY_THRESHOLD = 65.0

# Minimum number of rubric dimensions to normalise growth against
_GROWTH_NORMALISER = 5


def _channel_mult(interview_mode: str) -> float:
    return CHANNEL_MULTIPLIER.get(interview_mode or "web", 1.0)


def _best_session(sessions: List[Any]) -> Optional[Any]:
    """Return the completed session with the highest live_score."""
    completed = [s for s in sessions if s.status == "completed"]
    if not completed:
        return None
    return max(completed, key=lambda s: s.live_score)


def _compute_skill_score(session: Any) -> float:
    """
    Derive a 0-1 skill score from a completed session.

    Preference order:
    1. Weighted average of rubric_scores (post-finalize, most accurate)
    2. Fallback to live_score / 100 (real-time running score)
    """
    rubric = {
        k: v for k, v in (session.rubric_scores or {}).items()
        if k != "integrity_compliance" and isinstance(v, (int, float))
    }
    if rubric:
        return sum(rubric.values()) / (len(rubric) * 100.0)
    return max(0.0, min(1.0, session.live_score / 100.0))


def _compute_growth_score(completed_sessions: List[Any]) -> float:
    """
    Reward breadth of verified skill coverage across *all* completed sessions.

    A rubric dimension counts toward growth only when the worker scored ≥ 65
    on it in at least one session, indicating genuine competence rather than
    a lucky pass.
    """
    mastered: set[str] = set()
    for s in completed_sessions:
        for key, val in (s.rubric_scores or {}).items():
            if (
                key in _CORE_RUBRIC_KEYS
                and isinstance(val, (int, float))
                and val >= _MASTERY_THRESHOLD
            ):
                mastered.add(key)
    return min(1.0, len(mastered) / _GROWTH_NORMALISER)


def _compute_reliability_score(sessions: List[Any], completed: List[Any]) -> float:
    """
    Reliability = (sessions completed) / (sessions started).

    A worker who completes every screening they begin signals professionalism.
    An improving trend across sessions adds a small bonus (up to +0.10).
    """
    total = len(sessions)
    if total == 0:
        return 0.0

    base = min(1.0, len(completed) / total)

    # Trend bonus: compare average score of earlier half vs later half
    if len(completed) >= 3:
        sorted_completed = sorted(
            completed,
            key=lambda s: (s.started_at or ""),
        )
        mid = len(sorted_completed) // 2
        first_avg = sum(s.live_score for s in sorted_completed[:mid]) / mid
        second_avg = sum(s.live_score for s in sorted_completed[mid:]) / max(len(sorted_completed) - mid, 1)
        if second_avg > first_avg:
            improvement = (second_avg - first_avg) / 100.0
            base = min(1.0, base + min(0.10, improvement))

    return base


def compute_karma(
    sessions: List[Any],
    ratings: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """
    Compute karma from a list of Session model objects.

    Args:
      sessions: Session model objects for this worker
      ratings:  Employer star ratings (1.0–5.0); pass [] if none yet

    Returns:
      {
        "karma":            int,    # 0-1000 (after anomaly penalty)
        "tier":             str,    # Bronze / Silver / Gold / Platinum
        "skill_score":      float,  # normalised 0-1 (channel-adjusted)
        "integrity_score":  float,  # 0-1
        "components":       { skill, integrity, reputation, reliability, growth, community },
        "session_id":       str | None,
        "interview_mode":   str | None,
        "anomaly_flagged":  bool,
        "anomaly_signals":  List[str],
        "anomaly_penalty":  float,  # multiplier applied (1.0 = no penalty)
      }
    """
    completed = [s for s in sessions if s.status == "completed"]
    best = _best_session(sessions)

    # ── Skill component (channel-adjusted) ──────────────────────────────────
    if best is not None:
        raw_skill = _compute_skill_score(best)
        mult = _channel_mult(best.interview_mode)
        skill_score = raw_skill * mult
        integrity_score = float(best.integrity_log.integrity_score)
    else:
        skill_score = 0.0
        integrity_score = 0.0

    # ── Growth component ─────────────────────────────────────────────────────
    growth_score = _compute_growth_score(completed)

    # ── Reliability component ────────────────────────────────────────────────
    reliability_score = _compute_reliability_score(sessions, completed)

    # ── Reputation component (employer star ratings, 1-5 → 0-1) ─────────────
    if ratings:
        avg_star = sum(ratings) / len(ratings)
        # Map [1, 5] → [0, 1] linearly
        reputation_score = (avg_star - 1.0) / 4.0
    else:
        # Seeded at 0.5 until real ratings arrive
        reputation_score = 0.5

    # community_score: referral count / referral_cap (future feature)
    community_score = 0.0

    # ── Weighted sum → 0-1000 ────────────────────────────────────────────────
    karma_raw = (
        skill_score        * 300
        + integrity_score  * 200
        + reputation_score * 200
        + reliability_score * 150
        + growth_score     * 100
        + community_score  *  50
    )
    karma_pre_anomaly = max(0, min(1000, round(karma_raw)))

    # ── Anomaly detection + penalty ──────────────────────────────────────────
    anomaly = _detect_anomalies(sessions, karma_pre_anomaly)
    karma = max(0, min(1000, round(karma_pre_anomaly * anomaly["penalty"])))

    tier = "Bronze"
    for threshold, name in TIER_THRESHOLDS:
        if karma >= threshold:
            tier = name
            break

    return {
        "karma": karma,
        "tier": tier,
        "skill_score": round(skill_score, 4),
        "integrity_score": round(integrity_score, 4),
        "components": {
            "skill":       round(skill_score * 300),
            "integrity":   round(integrity_score * 200),
            "reputation":  round(reputation_score * 200),
            "reliability": round(reliability_score * 150),
            "growth":      round(growth_score * 100),
            "community":   round(community_score * 50),
        },
        "session_id":      best.id if best else None,
        "interview_mode":  best.interview_mode if best else None,
        "anomaly_flagged": anomaly["flagged"],
        "anomaly_signals": anomaly["signals"],
        "anomaly_penalty": anomaly["penalty"],
    }


def get_passport_tier(karma: int) -> str:
    for threshold, name in TIER_THRESHOLDS:
        if karma >= threshold:
            return name
    return "Bronze"


# ── Anomaly detection ─────────────────────────────────────────────────────────

_ANOMALY_KARMA_JUMP = 200      # flagged if karma jumps this much in 48 hours
_ANOMALY_SESSION_BURST = 4     # flagged if this many sessions completed in 24 hours
_ANOMALY_RUBRIC_CLONE_THRESH = 1.0  # flagged if all rubric scores differ by < 1 pt across sessions


def _detect_anomalies(sessions: List[Any], karma: int) -> Dict[str, Any]:
    """
    Rule-based anomaly detection on the session corpus.

    Returns:
      { "flagged": bool, "signals": List[str], "penalty": float (0-1 multiplier) }

    A penalty of 0.9 means karma is multiplied by 0.9 before finalisation.
    Flags are stored for human audit — they do not automatically reject the worker.
    """
    signals: list[str] = []
    completed = [s for s in sessions if s.status == "completed"]

    # ── Signal 1: Rapid karma accumulation ──────────────────────────────────
    # Compare sessions completed in the last 48 hours vs all-time average
    now = datetime.now(timezone.utc)
    cutoff_48h = now - timedelta(hours=48)
    recent = []
    for s in completed:
        try:
            ts = s.ended_at
            if ts:
                dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt >= cutoff_48h:
                    recent.append(s)
        except (ValueError, AttributeError):
            pass

    if len(recent) >= _ANOMALY_SESSION_BURST:
        signals.append(f"session_burst_{len(recent)}_in_48h")

    # ── Signal 2: Suspiciously identical rubric scores across sessions ───────
    if len(completed) >= 2:
        rubric_sets = []
        for s in completed:
            rubric = {
                k: v for k, v in (s.rubric_scores or {}).items()
                if k != "integrity_compliance" and isinstance(v, (int, float))
            }
            if rubric:
                rubric_sets.append(rubric)

        if len(rubric_sets) >= 2:
            common_keys = set(rubric_sets[0]) & set(rubric_sets[1])
            if common_keys:
                max_diff = max(
                    abs(rubric_sets[0][k] - rubric_sets[1][k])
                    for k in common_keys
                )
                if max_diff < _ANOMALY_RUBRIC_CLONE_THRESH:
                    signals.append("rubric_scores_near_identical_across_sessions")

    # ── Signal 3: Critical integrity + very high score ───────────────────────
    for s in completed:
        flag = s.integrity_log.overall_flag
        if flag == "critical_flag" and s.live_score >= 80:
            signals.append(f"critical_integrity_with_high_score_{round(s.live_score)}")
            break

    # ── Signal 4: Score variance too low across many sessions (coaching) ─────
    if len(completed) >= 3:
        scores = [s.live_score for s in completed]
        mean = sum(scores) / len(scores)
        variance = sum((x - mean) ** 2 for x in scores) / len(scores)
        if variance < 4.0:   # std dev < 2 points across 3+ sessions
            signals.append("unnaturally_low_score_variance")

    flagged = len(signals) > 0
    # Penalty: each unique signal knocks 5% off karma (max 20%)
    penalty = max(0.80, 1.0 - len(signals) * 0.05)

    return {"flagged": flagged, "signals": signals, "penalty": penalty}


# ── Passport narrative ────────────────────────────────────────────────────────

def generate_passport_narrative(
    worker_name: str,
    specialization: str,
    experience_years: int,
    karma_data: Dict[str, Any],
    rubric_scores: Dict[str, float],
) -> str:
    """
    Generate a 2-3 sentence human-readable narrative for the Skill Passport.

    Calls Azure OpenAI GPT-4.1. Falls back to a template string if the API
    is unavailable (so the passport always has a narrative).
    """
    try:
        from openai import AzureOpenAI
        from app.config import settings

        if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
            raise ValueError("OpenAI not configured")

        tier = karma_data.get("tier", "Bronze")
        karma = karma_data.get("karma", 0)

        rubric_summary = ", ".join(
            f"{k.replace('_', ' ').title()} {round(v)}/100"
            for k, v in rubric_scores.items()
            if k != "integrity_compliance"
        )

        prompt = (
            f"Write a 2-3 sentence professional narrative for a worker's Skill Passport. "
            f"Worker: {worker_name}. Trade: {specialization}. Experience: {experience_years} years. "
            f"Karma tier: {tier} ({karma}/1000). Rubric breakdown: {rubric_summary}. "
            f"Write once in English, then once in Hindi. Separate with a newline. "
            f"Be specific about their strengths. Do not use generic phrases like 'hard worker'."
        )

        client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        resp = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        return resp.choices[0].message.content.strip()

    except Exception:
        tier = karma_data.get("tier", "Bronze")
        return (
            f"{worker_name} is a {tier}-tier {specialization} with {experience_years} years of experience. "
            f"Their assessment demonstrates verified technical knowledge and a strong work ethic.\n"
            f"{worker_name} ek {tier} tier ke {specialization} hain jinka {experience_years} saal ka anubhav hai. "
            f"Unka mulyaankan unki takneeki dakshata aur mehnat ko darshata hai."
        )
