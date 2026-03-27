"""
Karma Engine — compute a 0-1000 karma score for a worker from their session history.

Components (max points):
  skill_score        300  — rubric-weighted final score from finalize_session()
  integrity_score    200  — from IntegrityLog.integrity_score
  reputation_score   200  — employer ratings average (placeholder: 0 until ratings exist)
  reliability_score  150  — job completion rate (placeholder: 0.5 until job data exists)
  growth_score       100  — distinct knowledge topics mastered (placeholder)
  community_score     50  — referrals (placeholder)
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


def _channel_mult(interview_mode: str) -> float:
    return CHANNEL_MULTIPLIER.get(interview_mode, 1.0)


def _best_session(sessions: List[Any]) -> Optional[Any]:
    """Return the completed session with the highest live_score."""
    completed = [s for s in sessions if s.status == "completed"]
    if not completed:
        return None
    return max(completed, key=lambda s: s.live_score)


def compute_karma(sessions: List[Any]) -> Dict[str, Any]:
    """
    Compute karma from a list of Session model objects.

    Returns a dict:
      {
        "karma": int,          # 0-1000
        "tier": str,           # Bronze / Silver / Gold / Platinum
        "skill_score": float,  # normalised 0-1
        "integrity_score": float,
        "components": { ... }
      }
    """
    best = _best_session(sessions)

    # ── Skill component ─────────────────────────────────────────────
    if best is not None:
        raw_skill = best.live_score / 100.0  # normalise 0-1
        mult = _channel_mult(best.interview_mode)
        skill_score = raw_skill * mult
        integrity_score = best.integrity_log.integrity_score  # 0-1
    else:
        skill_score = 0.0
        integrity_score = 0.0

    # ── Placeholder components ───────────────────────────────────────
    reputation_score = 0.5   # neutral until employer ratings exist
    reliability_score = 0.5  # neutral until job history exists
    growth_score = 0.0
    community_score = 0.0

    # ── Weighted sum → 0-1000 ────────────────────────────────────────
    karma_raw = (
        skill_score       * 300
        + integrity_score * 200
        + reputation_score * 200
        + reliability_score * 150
        + growth_score    * 100
        + community_score *  50
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
            "skill":      round(skill_score * 300),
            "integrity":  round(integrity_score * 200),
            "reputation": round(reputation_score * 200),
            "reliability": round(reliability_score * 150),
            "growth":     round(growth_score * 100),
            "community":  round(community_score * 50),
        },
        "session_id": best.id if best else None,
        "interview_mode": best.interview_mode if best else None,
    }


def get_passport_tier(karma: int) -> str:
    for threshold, name in TIER_THRESHOLDS:
        if karma >= threshold:
            return name
    return "Bronze"
