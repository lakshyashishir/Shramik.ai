"""
Populate the Azure PostgreSQL database with worker profiles and job listings
for the platform demonstration.

Run from the backend/ directory:
    python -m scripts.seed_demo
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")

from app.database import engine, init_db
from app.db_models import JobDB, SessionDB, WorkerDB

# ── helpers ──────────────────────────────────────────────────────────────────

def ts(hours_ago: float = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours_ago)


def ts_iso(hours_ago: float = 0) -> str:
    return ts(hours_ago).isoformat()


# ── workers ───────────────────────────────────────────────────────────────────

WORKERS = [
    # Ramesh Kumar — Tailor, 12 years, web app persona
    WorkerDB(
        id="worker_ramesh001",
        name="Ramesh Kumar",
        specialization="Garment Stitching & Tailoring",
        experience_years=12,
        created_at=ts(3),
        phone_number="+919876540001",
    ),
    # Suresh Yadav — Canteen/Mess Worker, 2 years, IVR persona
    WorkerDB(
        id="worker_suresh002",
        name="Suresh Yadav",
        specialization="Canteen & Mess Operations",
        experience_years=2,
        created_at=ts(2),
        phone_number="+919876540002",
    ),
    # Review queue — tailor with low assessment confidence
    WorkerDB(
        id="worker_kavita003",
        name="Kavita Nair",
        specialization="Pattern Making & Suit Tailoring",
        experience_years=4,
        created_at=ts(36),
        phone_number="+919712345678",
    ),
    # Review queue — worker with integrity flag
    WorkerDB(
        id="worker_riyaz004",
        name="Mohammed Riyaz",
        specialization="Leather Work & Alterations",
        experience_years=8,
        created_at=ts(24),
        phone_number="+919654321987",
    ),
]

# ── sessions ──────────────────────────────────────────────────────────────────

SESSIONS = [

    # ── Ramesh Kumar: Gold Passport, score 84, PASS, Clear integrity ─────────
    # Web app interview. Family member walks in mid-interview (integrity moment)
    # but session ends Clear per passport card.
    SessionDB(
        id="session_ramesh001",
        worker_id="worker_ramesh001",
        worker_name="Ramesh Kumar",
        assignment="Demonstrate your tailoring expertise: explain your daily stitching workflow, which machines you use for different tasks, how you diagnose tension problems, and describe a quality check you do before delivering a finished garment.",
        status="completed",
        started_at=ts(2.5),
        ended_at=ts(1.5),
        live_score=84.0,
        recommendation="pass",
        current_phase="passport",
        interview_mode="web",
        summary=(
            "Ramesh demonstrated strong, practical tailoring expertise built over 12 years. "
            "He accurately described daily workflows covering cutting, stitching collars, cuffs and plackets, "
            "and lining attachment. His answer on overlock vs flatbed machine selection was precise and "
            "context-correct. He correctly stated 1cm seam allowance for collar attachment and described "
            "two reliable tension-fault indicators: thread tightness on top surface and loop formation on the underside. "
            "The photo cross-examination revealed self-awareness — he identified a known thread-gauge issue before "
            "the AI flagged it, then articulated a correct corrective process. "
            "A brief integrity pause occurred when a family member entered, but Ramesh resumed immediately. "
            "Overall: confident, technically accurate, production-ready tailor. Gold Passport awarded."
        ),
        rubric_scores={
            "stitch_quality": 91.0,
            "machine_familiarity": 88.0,
            "technical_knowledge": 82.0,
            "fabric_material_knowledge": 79.0,
            "communication_confidence": 74.0,
            "integrity_compliance": 100.0,
        },
        self_ratings={
            "stitch_quality": 85.0,
            "machine_familiarity": 82.0,
            "technical_knowledge": 80.0,
        },
        assessment_confidence={"overall": 0.91, "rubric_coverage": 0.93, "answer_depth": 0.89},
        integrity_log={
            "multiface_events": 1,
            "multiface_resolved": True,
            "face_absent_events": 0,
            "gaze_deviation_events": 0,
            "face_change_detected": False,
            "session_paused": False,
            "pause_reason": None,
            "overall_flag": "clear",
            "integrity_score": 1.0,
            "last_event_at": ts_iso(2.1),
        },
        integrity_events=[
            {
                "event": "multi_face_warning",
                "severity": "warning",
                "source": "mediapipe",
                "timestamp": ts_iso(2.1),
                "details": {"note": "Family member briefly entered frame"},
            },
            {
                "event": "multi_face_resolved",
                "severity": "info",
                "source": "mediapipe",
                "timestamp": ts_iso(2.05),
                "details": {},
            },
        ],
        snapshot_feedback=[{
            "captured_at": ts_iso(1.8),
            "quality_score": 89.0,
            "feedback": "Collar seam is clean and consistent. Right-side corner shows a very slight thread raise consistent with thick-gauge thread — candidate self-identified and explained this correctly. Overall finishing is production quality.",
            "focus_areas": ["seam straightness", "edge finishing"],
            "note": "Finished shirt collar — flatbed stitched",
            "vision_confidence": 0.93,
        }],
        portfolio_enrichment=[],
        prior_work_media=[],
        transcript=[
            {
                "speaker": "ai",
                "text": "Namaste. Main aapka Shramik Mitra hoon. Aaj aapko koi form nahi bharna. Koi test nahi dena. Bas mujhse baat karein — jaise kisi dost se karte hain. Shuru karte hain? Apna naam aur kaam bataaiye.",
                "timestamp": ts_iso(2.5),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Ramesh... Ramesh Kumar. Main darzi hoon. Barah saal se garment ka kaam kar raha hoon.",
                "timestamp": ts_iso(2.48),
                "rubric_tag": "communication_confidence",
                "acoustic_confidence": 0.94,
            },
            {
                "speaker": "ai",
                "text": "Ramesh, bahut achha. Aapka naam register ho gaya. Ab hum aapki skills ke baare mein baat karenge. Koi sahi ya galat jawaab nahi hota — bas jo aap jaante hain, woh bataaiye. Theek hai?",
                "timestamp": ts_iso(2.45),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Theek hai.",
                "timestamp": ts_iso(2.43),
                "rubric_tag": "communication_confidence",
                "acoustic_confidence": 0.97,
            },
            {
                "speaker": "ai",
                "text": "Ramesh, rozaana kaam mein aap sabse zyaada kaun-sa kaam karte hain?",
                "timestamp": ts_iso(2.40),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Zyaadatar kaataai aur silaai. Collar, cuff, placket. Kuch orders mein lining bhi lagaani padti hai. Supervisor ka check hota hai — toh quality pe dhyaan rakhna padta hai.",
                "timestamp": ts_iso(2.37),
                "rubric_tag": "machine_familiarity",
                "acoustic_confidence": 0.93,
            },
            {
                "speaker": "ai",
                "text": "Aapne overlock ka zikr kiya — overlock aur flatbed mein aap kab kya choose karte hain?",
                "timestamp": ts_iso(2.33),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Overlock edge finish ke liye — khaaskar agar fabric fray karti ho. Flatbed main collar ke liye, cuff ke liye use karta hoon. Wahan seedha seam chahiye — overlock ka finishing alag hota hai.",
                "timestamp": ts_iso(2.30),
                "rubric_tag": "technical_knowledge",
                "acoustic_confidence": 0.95,
            },
            {
                "speaker": "ai",
                "text": "Collar attach karte waqt seam allowance kitna rakhte hain? Aur agar tension galat ho — kaise pata chalega?",
                "timestamp": ts_iso(2.26),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Ek centimeter. Collar pe kam rakhoge toh fabric pull karegi — khaaskar cotton mein. Tension galat ho toh — thread upar se tight dikhega. Ya neeche se loop banta hai. Machine ki awaaz bhi thodi change hoti hai — anubhav se pata chalta hai.",
                "timestamp": ts_iso(2.22),
                "rubric_tag": "technical_knowledge",
                "acoustic_confidence": 0.96,
            },
            {
                "speaker": "ai",
                "text": "Ramesh, kya aap apne kisi kaam ki ek photo le sakte hain? Jo silaai aapne recently ki ho — collar, seam, kuch bhi chalega.",
                "timestamp": ts_iso(2.18),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "ai",
                "text": "Aapki photo dekh raha hoon. Is collar ke right side pe — seam line mein ek jagah dhaga thoda utha hua hai. Woh corner — kya woh overlock pe tha ya flatbed pe?",
                "timestamp": ts_iso(1.95),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Flatbed pe tha. Us din dhaage ka number thoda bada tha. Mujhe pata tha yeh hoga — lekin order urgent tha. Supervisor ne pass kar diya.",
                "timestamp": ts_iso(1.92),
                "rubric_tag": "stitch_quality",
                "acoustic_confidence": 0.94,
            },
            {
                "speaker": "ai",
                "text": "Samajh gaya. Aur agar aapko dobaara karna hota — kya alag karte?",
                "timestamp": ts_iso(1.88),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Pehle scrap pe test karta. Dhaage ki tension check karta — do, teen stitch. Phir collar pe jaata.",
                "timestamp": ts_iso(1.85),
                "rubric_tag": "stitch_quality",
                "acoustic_confidence": 0.95,
            },
            {
                "speaker": "system",
                "text": "[Multi-face detected — interview paused]",
                "timestamp": ts_iso(2.1),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "ai",
                "text": "Lagta hai ghar mein koi aur aa gaya. Koi baat nahi — jab aap akele ho jaayein, mujhe bata dijiye. Main yahin hoon. Interview pause hai.",
                "timestamp": ts_iso(2.1),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "system",
                "text": "[Session resumed]",
                "timestamp": ts_iso(2.05),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Theek hai, ab akela hoon.",
                "timestamp": ts_iso(2.04),
                "rubric_tag": None,
                "acoustic_confidence": 0.91,
            },
            {
                "speaker": "ai",
                "text": "Shukriya, Ramesh. Chalte hain aage.",
                "timestamp": ts_iso(2.03),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "ai",
                "text": "Ramesh, bahut-bahut shukriya. Aapne aaj kuch aisa share kiya jo koi form capture nahi kar sakta tha. Aapka Skill Passport ban raha hai.",
                "timestamp": ts_iso(1.6),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Suresh Yadav: Silver Passport, score 67, PASS, Clear integrity ────────
    # IVR call — keypad phone. No smartphone needed.
    SessionDB(
        id="session_suresh001",
        worker_id="worker_suresh002",
        worker_name="Suresh Yadav",
        assignment="Tell us about your canteen work: how many people you cook for, how you handle kitchen emergencies, what you do when ingredients run short, and how you would prepare for your first day at a new canteen.",
        status="completed",
        started_at=ts(1.8),
        ended_at=ts(1.0),
        live_score=67.0,
        recommendation="pass",
        current_phase="passport",
        interview_mode="ivr_call",
        summary=(
            "Suresh showed solid operational instincts for large-scale canteen management despite only 2 years of experience. "
            "Scale answer was accurate (500+ students, 3 meals/day). "
            "The gas-cylinder emergency response was immediate and multi-step — calling supervisor, running backup induction, "
            "substituting no-cook items — demonstrating real crisis-management skill. "
            "Salt correction technique (potato/flour absorption) was correct and practical. "
            "The new-canteen preparation plan was structured and sequenced correctly: night prep, overnight dal soak, "
            "cylinder check, 6 AM rice start, backup menu planning. "
            "Communication is clear and practical, slightly informal but confident when talking about actual work. "
            "Silver Passport awarded. Strong candidate for canteen supervisor roles."
        ),
        rubric_scores={
            "operational_planning": 78.0,
            "bulk_cooking_knowledge": 71.0,
            "sanitation_awareness": 64.0,
            "communication_confidence": 61.0,
            "integrity_compliance": 100.0,
        },
        self_ratings={
            "operational_planning": 70.0,
            "bulk_cooking_knowledge": 65.0,
            "communication_confidence": 60.0,
        },
        assessment_confidence={"overall": 0.86, "rubric_coverage": 0.84, "answer_depth": 0.88},
        integrity_log={
            "multiface_events": 0,
            "multiface_resolved": True,
            "face_absent_events": 0,
            "gaze_deviation_events": 0,
            "face_change_detected": False,
            "session_paused": False,
            "pause_reason": None,
            "overall_flag": "clear",
            "integrity_score": 1.0,
            "last_event_at": None,
        },
        integrity_events=[],
        snapshot_feedback=[],
        portfolio_enrichment=[],
        prior_work_media=[],
        transcript=[
            {
                "speaker": "ai",
                "text": "Namaste. Shramik Mitra mein aapka swagat hai. Aaj aap koi form nahi bharenge. Koi button nahi dabaayenge. Bas mujhse baat karein. Apna naam bataaiye, aur woh kaam jisme aap mahir hain.",
                "timestamp": ts_iso(1.8),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Suresh... Suresh Yadav. Main canteen mein kaam karta hoon. Khaana banaana, safaai, aur sab manage karna.",
                "timestamp": ts_iso(1.77),
                "rubric_tag": "communication_confidence",
                "acoustic_confidence": 0.89,
            },
            {
                "speaker": "ai",
                "text": "Suresh, bahut achha. Aap jaisa kaam karte hain — woh bahut mushkil hota hai. Hum thodi der baat karenge — aap jo karte hain, woh theek se samjhenge. Koi jaldi nahi. Theek hai?",
                "timestamp": ts_iso(1.74),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Haan. Theek hai.",
                "timestamp": ts_iso(1.72),
                "rubric_tag": "communication_confidence",
                "acoustic_confidence": 0.92,
            },
            {
                "speaker": "ai",
                "text": "Suresh, ek din mein kitne logon ke liye khaana banate hain? Aur din mein kitni baar?",
                "timestamp": ts_iso(1.69),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Paanch sau se thoda zyaada — teen time. Breakfast, lunch, dinner. Aur kabhi kabhi extra order aa jaata hai — events wagarah.",
                "timestamp": ts_iso(1.66),
                "rubric_tag": "operational_planning",
                "acoustic_confidence": 0.91,
            },
            {
                "speaker": "ai",
                "text": "Aur agar subah saat baje — gas cylinder khatam ho jaaye, aur breakfast ek ghante mein chahiye — aap kya karenge?",
                "timestamp": ts_iso(1.62),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Pehle supervisor ko call karta hoon — emergency delivery ka number hai. Saath mein electric induction chalaata hoon jo reserve mein hai. Jo cheez gas pe jaldi nahi ban sakti — woh baad ke liye shift karta hoon. Poha ya cornflakes pehle serve karta hoon — woh bina gas ke ho jaata hai. Kisi ko pata nahi chalta zyaada.",
                "timestamp": ts_iso(1.58),
                "rubric_tag": "operational_planning",
                "acoustic_confidence": 0.93,
            },
            {
                "speaker": "ai",
                "text": "Daal mein namak zyaada pad jaaye — ek baar mein bahut zyaada — kya karoge?",
                "timestamp": ts_iso(1.54),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Aataa ya aalu — do teen bade tukde daal deta hoon. Thodi der baad nikaal leta hoon — woh namak absorb kar lete hain. Phir taste check karta hoon. Zyaada galat ho toh thoda paani aur ek aur tadka. Daal waste nahi hoti.",
                "timestamp": ts_iso(1.50),
                "rubric_tag": "bulk_cooking_knowledge",
                "acoustic_confidence": 0.90,
            },
            {
                "speaker": "ai",
                "text": "Suresh, ek aakhri sawaal. Maan lo kal subah aapka pehla din hai ek naye canteen mein. Das baje se pehle do sau logon ka breakfast ready hona chahiye. Aaj raat aap kya kya karenge — step by step batao.",
                "timestamp": ts_iso(1.46),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
            {
                "speaker": "worker",
                "text": "Pehle — sabziyaan kaatna. Pyaaz, tamatar, aalu. Raat ko kar lo toh subah time bachta hai. Daal bhigo deta hoon raat ko — jaldi pakti hai phir. Subah ka menu dekhkar decide karta hoon — agar poha hai toh chooda pehle se rakhna. Cylinder zaroor check karna — ek baar pehle se hi dekh lo. Chaawal subah chhe baje se charhaana padega. Aur ek backup rakhna — agar koi cheez nahi bani toh kya serve karenge — woh sochkar rakhna. Bas.",
                "timestamp": ts_iso(1.42),
                "rubric_tag": "operational_planning",
                "acoustic_confidence": 0.92,
            },
            {
                "speaker": "ai",
                "text": "Suresh... Aap woh karte hain jo bahut kam log kar sakte hain. Bahut shukriya aapka. Aapka Skill Passport tayyar ho raha hai.",
                "timestamp": ts_iso(1.05),
                "rubric_tag": None,
                "acoustic_confidence": None,
            },
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Kavita Nair: Review Queue — low assessment confidence (0.61) ──────────
    SessionDB(
        id="session_kavita001",
        worker_id="worker_kavita003",
        worker_name="Kavita Nair",
        assignment="Explain the pattern making process for a structured men's blazer: drafting approach, ease allowances, grain line considerations, and how you handle fitting adjustments.",
        status="completed",
        started_at=ts(34),
        ended_at=ts(33),
        live_score=57.2,
        recommendation="hold",
        current_phase="passport",
        interview_mode="web",
        summary=(
            "Kavita showed basic understanding of pattern making but answers lacked technical depth. "
            "She correctly identified grain lines and ease allowances but could not specify "
            "numeric ease values for a structured blazer. Fitting adjustment process was vague. "
            "It is unclear whether gaps reflect limited experience or nerves during the interview. "
            "Assessment confidence is low — recommend a follow-up practical evaluation before placement."
        ),
        rubric_scores={
            "stitch_quality": 52.0,
            "machine_familiarity": 60.0,
            "technical_knowledge": 50.0,
            "fabric_material_knowledge": 55.0,
            "communication_confidence": 65.0,
            "integrity_compliance": 82.0,
        },
        self_ratings={
            "stitch_quality": 70.0,
            "machine_familiarity": 72.0,
            "technical_knowledge": 68.0,
        },
        assessment_confidence={"overall": 0.61, "rubric_coverage": 0.68, "answer_depth": 0.54},
        integrity_log={
            "multiface_events": 0,
            "multiface_resolved": True,
            "face_absent_events": 0,
            "gaze_deviation_events": 2,
            "face_change_detected": False,
            "session_paused": False,
            "pause_reason": None,
            "overall_flag": "minor_warning",
            "integrity_score": 0.85,
            "last_event_at": ts_iso(33.4),
        },
        integrity_events=[
            {"event": "gaze_away", "severity": "warning", "source": "mediapipe", "timestamp": ts_iso(33.7), "details": {"duration_ms": 1800}},
            {"event": "gaze_away", "severity": "warning", "source": "mediapipe", "timestamp": ts_iso(33.4), "details": {"duration_ms": 1100}},
        ],
        snapshot_feedback=[{
            "captured_at": ts_iso(33.2),
            "quality_score": 58.0,
            "feedback": "Seam lines are mostly straight but seam allowance varies between 0.8cm and 1.4cm. Edge finishing shows some fraying at corners.",
            "focus_areas": ["seam straightness", "edge finishing"],
            "note": "Blazer front panel draft",
            "vision_confidence": 0.78,
        }],
        portfolio_enrichment=[],
        prior_work_media=[],
        transcript=[
            {"speaker": "ai", "text": "Namaste Kavita ji! Pattern making ke baare mein bataaiye — men's blazer ka basic block kaise draft karti hain?", "timestamp": ts_iso(34), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Pehle measurements leti hoon — chest, waist, shoulder. Phir basic block draw karti hoon. Grain line straight rakhti hoon.", "timestamp": ts_iso(33.97), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.82},
            {"speaker": "ai", "text": "Structured blazer ke liye chest aur seat pe kitna ease allowance deti hain?", "timestamp": ts_iso(33.93), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Thoda ease deti hoon movement ke liye... blazer mein zyaada ease hota hai shirt se. Exact number abhi yaad nahi hai.", "timestamp": ts_iso(33.90), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.80},
            {"speaker": "ai", "text": "Grain line kis direction mein rakhti hain blazer front panel pe, aur kyun?", "timestamp": ts_iso(33.87), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Straight grain — vertical direction mein. Yeh isliye important hai ki fabric hang properly kare.", "timestamp": ts_iso(33.84), "rubric_tag": "fabric_material_knowledge", "acoustic_confidence": 0.85},
            {"speaker": "ai", "text": "Fitting adjustment ke liye — agar blazer shoulder pe tight ho toh pattern mein kya change karti hain?", "timestamp": ts_iso(33.80), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Shoulder seam ko thoda bahar nikaalna. Armhole bhi adjust hoga saath mein.", "timestamp": ts_iso(33.77), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.78},
            {"speaker": "ai", "text": "Kavita ji, aapka screening complete hua. Aapka score processed ho raha hai — recruiter aapke results review karenge.", "timestamp": ts_iso(33.2), "rubric_tag": None, "acoustic_confidence": None},
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Mohammed Riyaz: Review Queue — integrity requires_review ─────────────
    SessionDB(
        id="session_riyaz001",
        worker_id="worker_riyaz004",
        worker_name="Mohammed Riyaz",
        assignment="Describe your leather work expertise: tools you use, how you handle edge finishing, skiving technique, and what quality checks you apply before delivering a finished piece.",
        status="completed",
        started_at=ts(22),
        ended_at=ts(21),
        live_score=67.5,
        recommendation="hold",
        current_phase="passport",
        interview_mode="web",
        summary=(
            "Mohammed showed good practical knowledge of leather work — edge finishing and skiving "
            "technique were described correctly. Tool knowledge is solid. However, the session was "
            "paused once due to a face-absent event and the integrity flag is 'requires_review'. "
            "Content quality would likely support a pass if integrity is confirmed. Human review recommended."
        ),
        rubric_scores={
            "stitch_quality": 70.0,
            "machine_familiarity": 68.0,
            "technical_knowledge": 72.0,
            "fabric_material_knowledge": 65.0,
            "communication_confidence": 62.0,
            "integrity_compliance": 50.0,
        },
        self_ratings={
            "stitch_quality": 78.0,
            "machine_familiarity": 75.0,
            "technical_knowledge": 80.0,
        },
        assessment_confidence={"overall": 0.83, "rubric_coverage": 0.85, "answer_depth": 0.81},
        integrity_log={
            "multiface_events": 0,
            "multiface_resolved": True,
            "face_absent_events": 1,
            "gaze_deviation_events": 1,
            "face_change_detected": False,
            "session_paused": True,
            "pause_reason": "face_absent",
            "overall_flag": "requires_review",
            "integrity_score": 0.5,
            "last_event_at": ts_iso(21.5),
        },
        integrity_events=[
            {"event": "face_absent", "severity": "warning", "source": "mediapipe", "timestamp": ts_iso(21.8), "details": {"duration_ms": 4200}},
            {"event": "resume", "severity": "info", "source": "mediapipe", "timestamp": ts_iso(21.5), "details": {}},
            {"event": "gaze_away", "severity": "warning", "source": "mediapipe", "timestamp": ts_iso(21.3), "details": {"duration_ms": 900}},
        ],
        snapshot_feedback=[{
            "captured_at": ts_iso(21.2),
            "quality_score": 72.0,
            "feedback": "Edge finishing on leather panel is clean with bevelled edges and burnished surface. Skiving cut is even. Hand stitching holes are uniformly spaced.",
            "focus_areas": ["seam straightness", "edge finishing"],
            "note": "Leather belt panel with edge finishing",
            "vision_confidence": 0.88,
        }],
        portfolio_enrichment=[],
        prior_work_media=[],
        transcript=[
            {"speaker": "ai", "text": "Namaste Riyaz ji! Aap leather work mein kitne saal se hain aur kis type ka kaam zyaada karte hain?", "timestamp": ts_iso(22), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "8 saal se hoon. Bags, belts aur shoes repair karta hoon. Custom leather jackets bhi banata hoon kabhi kabhi.", "timestamp": ts_iso(21.97), "rubric_tag": "communication_confidence", "acoustic_confidence": 0.88},
            {"speaker": "ai", "text": "Edge finishing ke liye aap kya process use karte hain?", "timestamp": ts_iso(21.93), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Pehle edge ko beveller se trim karta hoon. Phir edge paint ya beeswax lagaata hoon. Phir burnisher se polish karta hoon jab tak smooth na ho jaaye. Thick leather pe multiple coats deta hoon.", "timestamp": ts_iso(21.90), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.90},
            {"speaker": "ai", "text": "Skiving kab aur kaise karte hain?", "timestamp": ts_iso(21.87), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Skiving tab karte hain jab seam join karna ho — thickness kam karte hain taaki bulky na ho. Sharp skiving knife use karta hoon, 45-degree angle pe cut karta hoon. Consistent pressure zaroori hai warna uneven ho jaata hai.", "timestamp": ts_iso(21.84), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.87},
            {"speaker": "system", "text": "[Session paused — face absent detected]", "timestamp": ts_iso(21.8), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "system", "text": "[Session resumed]", "timestamp": ts_iso(21.5), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "ai", "text": "Session resume ho gayi hai. Quality check — piece deliver karne se pehle aap kya check karte hain?", "timestamp": ts_iso(21.45), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Stitching lines check karta hoon — even honi chahiye. Edges smooth hone chahiye. Zipper aur hardware properly kaam karne chahiye. Aur smell check karta hoon — chemicals ka smell nahi hona chahiye finished piece mein.", "timestamp": ts_iso(21.42), "rubric_tag": "stitch_quality", "acoustic_confidence": 0.85},
            {"speaker": "ai", "text": "Shukriya Riyaz ji. Aapka session complete hua. Results recruiter ke paas review ke liye jayenge.", "timestamp": ts_iso(21.2), "rubric_tag": None, "acoustic_confidence": None},
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),
]

# ── jobs ──────────────────────────────────────────────────────────────────────
# Mix of garment factory roles (relevant for Ramesh) and canteen/hospitality roles
# (relevant for Suresh — including the supervisor role he previously couldn't apply for)

JOBS = [
    # The canteen supervisor job — the one Suresh couldn't apply for (required smartphone).
    # Now he can — because Shramik.ai verified him via voice call.
    JobDB(
        id="job_canteen_sup_001",
        title="Canteen Supervisor — University Hostel",
        budget="Rs. 18,000–22,000/month",
        skill="Canteen Operations",
        urgent=True,
        location="Pune, Maharashtra",
        description="Seeking an experienced canteen supervisor for a 600-student university hostel. Must manage 3 daily meals, coordinate with suppliers, oversee 4 kitchen staff, handle inventory and hygiene compliance. Prior large-scale cooking experience required. Verified Shramik Passport preferred.",
        posted_at=ts(4),
    ),
    # Garment factory job — relevant for Ramesh
    JobDB(
        id="job_garment_factory_001",
        title="Production Tailor — Garment Factory",
        budget="Rs. 14,000–18,000/month",
        skill="Industrial Stitching",
        urgent=True,
        location="Delhi NCR",
        description="Leading garment export unit hiring experienced tailors for collar, cuff and placket assembly line. Must have 5+ years experience with industrial flatbed and overlock machines. Quality supervisor checks apply. Shramik Passport (Gold/Silver) strongly preferred — no paper certificate required.",
        posted_at=ts(6),
    ),
    # Another canteen role
    JobDB(
        id="job_mess_worker_001",
        title="Senior Mess Cook — Corporate Cafeteria",
        budget="Rs. 14,000–17,000/month",
        skill="Bulk Cooking",
        urgent=False,
        location="Bengaluru, Karnataka",
        description="IT campus cafeteria needs a senior cook for 400-person daily service. Breakfast and lunch. Must handle bulk dal, sabzi and rice prep. Experience with gas and induction cooking required. Knowledge of portion control and food safety is a plus.",
        posted_at=ts(12),
    ),
    # Stitching alteration role
    JobDB(
        id="job_alterations_001",
        title="Garment Alteration Specialist",
        budget="Rs. 600–900 per piece",
        skill="Alterations",
        urgent=False,
        location="Mumbai, Maharashtra",
        description="Boutique clothing store needs a skilled alteration tailor for hem shortening, waist suppression, and sleeve adjustments. Collar and cuff work a bonus. 10–20 pieces per day. Can work from home or on-site. Verified experience preferred.",
        posted_at=ts(18),
    ),
    # Industrial stitching run
    JobDB(
        id="job_production_run_001",
        title="Industrial Stitching — 300 pcs Kurta Run",
        budget="Rs. 45–60 per piece",
        skill="Industrial Stitching",
        urgent=False,
        location="Jaipur, Rajasthan",
        description="Production run of 300 cotton kurtas. Side seam, sleeve attach and hem finish. Need consistent 1.2cm seam allowance and clean overlock edge. Juki or Brother flatbed required. Delivery in 10 days. Piece-rate payment.",
        posted_at=ts(24),
    ),
    # Canteen helper — entry-level for workers like Suresh
    JobDB(
        id="job_canteen_helper_001",
        title="Canteen Helper — School Midday Meal",
        budget="Rs. 9,000–11,000/month",
        skill="Canteen Operations",
        urgent=False,
        location="Lucknow, Uttar Pradesh",
        description="Government school midday meal kitchen hiring a canteen helper. Cooking and serving for 250 children daily. Experience with large vessel cooking and hygiene maintenance required. UP location preferred — accommodation available.",
        posted_at=ts(30),
    ),
    # Pattern making freelance
    JobDB(
        id="job_pattern_maker_001",
        title="Freelance Pattern Maker — Women's Wear",
        budget="Rs. 800–1,200 per pattern",
        skill="Pattern Making",
        urgent=False,
        location="Remote / Chennai",
        description="Small fashion label needs a freelance pattern maker for a 8-piece women's collection. Kurta, palazzo and blouse. Technical drawings provided. Gerber or manual drafting accepted. Turnaround 3–5 days per pattern.",
        posted_at=ts(48),
    ),
    # Hotel kitchen
    JobDB(
        id="job_hotel_kitchen_001",
        title="Kitchen Assistant — 3-Star Hotel",
        budget="Rs. 12,000–15,000/month",
        skill="Bulk Cooking",
        urgent=True,
        location="Agra, Uttar Pradesh",
        description="Budget hotel near Taj Mahal hiring a kitchen assistant for breakfast and lunch service (80–100 covers). Must manage mise en place, bulk vegetable prep and cleaning. Morning shift 5 AM–2 PM. Accommodation provided.",
        posted_at=ts(8),
    ),
]

# ── main ──────────────────────────────────────────────────────────────────────

async def seed():
    print("Initialising database tables...")
    await init_db()

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as db:
        print("Clearing existing profile data...")
        for model_cls, ids in [
            (SessionDB, [s.id for s in SESSIONS]),
            (WorkerDB, [w.id for w in WORKERS]),
            (JobDB, [j.id for j in JOBS]),
        ]:
            for eid in ids:
                existing = await db.get(model_cls, eid)
                if existing:
                    await db.delete(existing)
        await db.commit()

        print(f"Inserting {len(WORKERS)} workers...")
        for w in WORKERS:
            db.add(w)
        await db.commit()

        print(f"Inserting {len(SESSIONS)} sessions...")
        for s in SESSIONS:
            db.add(s)
        await db.commit()

        print(f"Inserting {len(JOBS)} jobs...")
        for j in JOBS:
            db.add(j)
        await db.commit()

    print("\nComplete!")
    print("  Workers : Ramesh Kumar (Gold/84), Suresh Yadav (Silver/67), Kavita Nair (review), Mohammed Riyaz (review)")
    print("  Sessions: 4 completed — 2 pass, 2 in review queue")
    print(f"  Jobs    : {len(JOBS)} listings")


if __name__ == "__main__":
    asyncio.run(seed())
