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

from typing import Any, Dict, List, Optional

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


def compute_karma(sessions: List[Any]) -> Dict[str, Any]:
    """
    Compute karma from a list of Session model objects.

    Returns:
      {
        "karma":            int,    # 0-1000
        "tier":             str,    # Bronze / Silver / Gold / Platinum
        "skill_score":      float,  # normalised 0-1 (channel-adjusted)
        "integrity_score":  float,  # 0-1
        "components":       { skill, integrity, reputation, reliability, growth, community },
        "session_id":       str | None,
        "interview_mode":   str | None,
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

    # ── Future components (seeded at neutral values) ─────────────────────────
    # reputation_score: will be derived from post-hire employer ratings (1-5 stars → 0-1)
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
    karma = max(0, min(1000, round(karma_raw)))

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
        "session_id":     best.id if best else None,
        "interview_mode": best.interview_mode if best else None,
    }


def get_passport_tier(karma: int) -> str:
    for threshold, name in TIER_THRESHOLDS:
        if karma >= threshold:
            return name
    return "Bronze"
