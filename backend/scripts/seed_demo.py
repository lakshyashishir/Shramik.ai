"""
Seed the Azure PostgreSQL database with high-quality demo data.

Run from the backend/ directory:
    python -m scripts.seed_demo
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

# ensure app package is importable
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
    WorkerDB(
        id="worker_arjun001",
        name="Arjun Sharma",
        specialization="Bridal & Zardozi Embroidery",
        experience_years=11,
        created_at=ts(72),
        phone_number="+919876543210",
    ),
    WorkerDB(
        id="worker_priya002",
        name="Priya Mehra",
        specialization="Industrial Stitching",
        experience_years=6,
        created_at=ts(48),
        phone_number="+919823456701",
    ),
    WorkerDB(
        id="worker_kavita003",
        name="Kavita Nair",
        specialization="Pattern Making & Suit Tailoring",
        experience_years=4,
        created_at=ts(36),
        phone_number="+919712345678",
    ),
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
    # ── Arjun: Platinum, score 91.4, PASS, clear integrity ───────────────────
    SessionDB(
        id="session_arjun001",
        worker_id="worker_arjun001",
        worker_name="Arjun Sharma",
        assignment="Demonstrate mastery of zardozi embroidery: explain thread tension, needle gauge selection, fabric stabilisation technique, and quality checks you apply before handing off finished pieces.",
        status="completed",
        started_at=ts(70),
        ended_at=ts(69),
        live_score=91.4,
        recommendation="pass",
        current_phase="passport",
        interview_mode="web",
        summary=(
            "Arjun demonstrated expert-level command of zardozi embroidery. He explained "
            "thread tension calibration with exact gauge values, correctly sequenced "
            "fabric stabilisation (backing + hoop before embellishment), and described "
            "a rigorous QC process including loop-pull tests and colour-fastness checks. "
            "Communication was confident and fluent in Hindi with precise technical vocabulary. "
            "Snapshot photo showed immaculate seam work with consistent stitch density. "
            "Strongly recommended for client-facing bridal ateliers."
        ),
        rubric_scores={
            "stitch_quality": 96.0,
            "machine_familiarity": 88.0,
            "technical_knowledge": 93.0,
            "fabric_material_knowledge": 90.0,
            "communication_confidence": 84.0,
            "integrity_compliance": 95.0,
        },
        self_ratings={
            "stitch_quality": 90.0,
            "machine_familiarity": 85.0,
            "technical_knowledge": 88.0,
        },
        assessment_confidence={"overall": 0.94, "rubric_coverage": 0.96, "answer_depth": 0.92},
        integrity_log={
            "multiface_events": 0, "multiface_resolved": True,
            "face_absent_events": 0, "gaze_deviation_events": 0,
            "face_change_detected": False, "session_paused": False,
            "pause_reason": None, "overall_flag": "clear",
            "integrity_score": 1.0, "last_event_at": None,
        },
        integrity_events=[],
        snapshot_feedback=[{
            "captured_at": ts_iso(69.5),
            "quality_score": 94.0,
            "feedback": "Exceptional stitch density and thread tension. Zardozi motif edges are crisp with zero fraying. Backing fabric shows proper stabilisation technique.",
            "focus_areas": ["seam straightness", "edge finishing"],
            "note": "Zardozi peacock motif close-up",
            "vision_confidence": 0.97,
        }],
        portfolio_enrichment=[
            {
                "captured_at": ts_iso(70.2),
                "note": "Bridal dupatta with full zardozi border",
                "complexity": "complex",
                "vision_summary": "Intricate gold zardozi border on red silk dupatta. Stitch density consistent throughout 4m length. Excellent tension control.",
            }
        ],
        prior_work_media=[],
        transcript=[
            {"speaker": "ai", "text": "नमस्ते अर्जुन जी! आपका Shramik.ai screening में स्वागत है। आप कितने साल से zardozi embroidery का काम कर रहे हैं?", "timestamp": ts_iso(70), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "नमस्ते। मैं 11 साल से कर रहा हूं। पहले दिल्ली में सीखा, फिर सूरत में 4 साल काम किया। अभी Mumbai में अपनी छोटी workshop है।", "timestamp": ts_iso(69.98), "rubric_tag": "communication_confidence", "acoustic_confidence": 0.96},
            {"speaker": "ai", "text": "बहुत अच्छा। Zardozi में thread tension कैसे set करते हैं? किस needle gauge का use करते हैं raw silk पर?", "timestamp": ts_iso(69.95), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Raw silk पर हम 75/11 या 80/12 gauge needle use करते हैं। Thread tension 3.5 से 4 के बीच रखते हैं — ज़्यादा tension से silk damage होता है। Zardozi wire के लिए थोड़ा loose रखते हैं ताकि loop properly form हो।", "timestamp": ts_iso(69.92), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.94},
            {"speaker": "ai", "text": "Fabric stabilisation के लिए आप क्या process follow करते हैं embroidery शुरू करने से पहले?", "timestamp": ts_iso(69.88), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "पहले fabric को bias cut करके iron करते हैं। फिर muslin backing stitch करते हैं — यह fabric को stretch से बचाता है। फिर embroidery hoop में tight set करते हैं। Raw silk के लिए tissue paper layer भी लगाते हैं hoop के अंदर ताकि marks न पड़ें।", "timestamp": ts_iso(69.85), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.95},
            {"speaker": "ai", "text": "बेहतरीन! Quality check के लिए आप क्या steps follow करते हैं piece hand-off से पहले?", "timestamp": ts_iso(69.82), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "पहले light box पर रखकर check करते हैं — इससे uneven stitches दिखते हैं। फिर gentle loop-pull test करते हैं हर motif पर। Colour fastness के लिए damp cloth से दबाते हैं। आखिर में edge finishing check करते हैं — कोई fraying नहीं होनी चाहिए। सब okay हो तो tissue में wrap करके deliver करते हैं।", "timestamp": ts_iso(69.78), "rubric_tag": "stitch_quality", "acoustic_confidence": 0.93},
            {"speaker": "ai", "text": "आपने एक photo submit की है — स्टitch work बहुत professional दिख रहा है। आपका Shramik Passport तैयार हो गया है। आप Platinum tier में हैं। बहुत बधाई!", "timestamp": ts_iso(69.5), "rubric_tag": None, "acoustic_confidence": None},
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Priya: Gold, score 76.8, PASS, clear integrity ───────────────────────
    SessionDB(
        id="session_priya001",
        worker_id="worker_priya002",
        worker_name="Priya Mehra",
        assignment="Explain your industrial stitching workflow: machine setup, seam types you're proficient in, how you diagnose and fix common defects, and how you maintain output quality under production pressure.",
        status="completed",
        started_at=ts(46),
        ended_at=ts(45),
        live_score=76.8,
        recommendation="pass",
        current_phase="passport",
        interview_mode="web",
        summary=(
            "Priya demonstrated solid industrial stitching competency. She articulated correct "
            "machine setup procedures including bobbin tension and presser foot selection. "
            "She identified flat-felled and overlock seams accurately and described realistic "
            "defect diagnosis for skipped stitches and puckering. Performance dips slightly "
            "on fabric weight knowledge — answered correctly but lacked precision on GSM ranges. "
            "Good candidate for mid-volume garment production lines."
        ),
        rubric_scores={
            "stitch_quality": 79.0,
            "machine_familiarity": 82.0,
            "technical_knowledge": 75.0,
            "fabric_material_knowledge": 68.0,
            "communication_confidence": 78.0,
            "integrity_compliance": 90.0,
        },
        self_ratings={
            "stitch_quality": 75.0,
            "machine_familiarity": 80.0,
            "technical_knowledge": 70.0,
        },
        assessment_confidence={"overall": 0.87, "rubric_coverage": 0.88, "answer_depth": 0.85},
        integrity_log={
            "multiface_events": 0, "multiface_resolved": True,
            "face_absent_events": 0, "gaze_deviation_events": 1,
            "face_change_detected": False, "session_paused": False,
            "pause_reason": None, "overall_flag": "minor_warning",
            "integrity_score": 0.85, "last_event_at": ts_iso(45.5),
        },
        integrity_events=[
            {"event": "gaze_away", "severity": "warning", "source": "mediapipe", "timestamp": ts_iso(45.5), "details": {"duration_ms": 1200}},
        ],
        snapshot_feedback=[{
            "captured_at": ts_iso(45.3),
            "quality_score": 78.0,
            "feedback": "Clean straight seam with consistent 1cm margin. Overlock finishing is neat. Minor tension variation visible at one corner — acceptable for production grade.",
            "focus_areas": ["seam straightness", "edge finishing"],
            "note": "Straight seam sample on poly-cotton",
            "vision_confidence": 0.91,
        }],
        portfolio_enrichment=[],
        prior_work_media=[],
        transcript=[
            {"speaker": "ai", "text": "नमस्ते प्रिया जी! आप industrial stitching में काम करती हैं — machine setup कैसे करती हैं नया batch शुरू करने से पहले?", "timestamp": ts_iso(46), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "सबसे पहले bobbin tension check करती हूं। फिर presser foot change करती हूं fabric के हिसाब से — denim के लिए heavy foot, chiffon के लिए roller foot। Needle भी change करती हूं — synthetic के लिए ball-point needle।", "timestamp": ts_iso(45.97), "rubric_tag": "machine_familiarity", "acoustic_confidence": 0.92},
            {"speaker": "ai", "text": "अच्छा। Flat-felled seam और overlock seam में क्या difference है? कब किसे use करती हैं?", "timestamp": ts_iso(45.93), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Flat-felled seam jeans और heavy fabrics में use होता है — यह double stitched होता है और बहुत strong होता है। Overlock seam edges को finish करने के लिए है, fabric fray नहीं होता। Light garments में overlock ज़्यादा use होता है।", "timestamp": ts_iso(45.90), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.89},
            {"speaker": "ai", "text": "अगर stitching के दौरान thread skip हो रहा हो, तो आप क्या diagnose करेंगी?", "timestamp": ts_iso(45.87), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Thread skip आमतौर पर needle की problem होती है — bent needle या wrong size। कभी-कभी thread path में problem होती है या tension बहुत loose होता है। पहले needle change करती हूं, फिर thread re-thread करती हूं, फिर tension adjust करती हूं।", "timestamp": ts_iso(45.84), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.91},
            {"speaker": "ai", "text": "Production pressure में quality maintain कैसे करती हैं?", "timestamp": ts_iso(45.80), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "हर 20-25 pieces के बाद एक piece check करती हूं। अगर कोई problem आए तो immediately बताती हूं supervisor को। Speed बढ़ाने के लिए shortcuts नहीं लेती — quality पहले।", "timestamp": ts_iso(45.77), "rubric_tag": "stitch_quality", "acoustic_confidence": 0.88},
            {"speaker": "ai", "text": "Priya ji, aapka Shramik Passport ready hai! Aap Gold tier mein hain — badhai ho!", "timestamp": ts_iso(45.3), "rubric_tag": None, "acoustic_confidence": None},
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Kavita: Review Queue — low assessment confidence (0.61) ───────────────
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
            "Assessment confidence is low — recommend a follow-up practical assessment or "
            "brief in-person evaluation before placement."
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
            "multiface_events": 0, "multiface_resolved": True,
            "face_absent_events": 0, "gaze_deviation_events": 2,
            "face_change_detected": False, "session_paused": False,
            "pause_reason": None, "overall_flag": "minor_warning",
            "integrity_score": 0.85, "last_event_at": ts_iso(33.4),
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
            {"speaker": "ai", "text": "नमस्ते कविता जी! Pattern making के बारे में बताइए — men's blazer का basic block कैसे draft करती हैं?", "timestamp": ts_iso(34), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "पहले measurements लेती हूं — chest, waist, shoulder। फिर basic block draw करती हूं। Grain line straight रखती हूं।", "timestamp": ts_iso(33.97), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.82},
            {"speaker": "ai", "text": "Structured blazer के लिए chest और seat पर कितना ease allowance देती हैं?", "timestamp": ts_iso(33.93), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "थोड़ा ease देती हूं movement के लिए... blazer में ज़्यादा ease होता है shirt से। Exact number अभी याद नहीं है।", "timestamp": ts_iso(33.90), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.80},
            {"speaker": "ai", "text": "ठीक है। Grain line किस direction में रखती हैं blazer front panel पर, और क्यों?", "timestamp": ts_iso(33.87), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Straight grain — vertical direction में। यह इसलिए important है कि fabric hang properly करे।", "timestamp": ts_iso(33.84), "rubric_tag": "fabric_material_knowledge", "acoustic_confidence": 0.85},
            {"speaker": "ai", "text": "Fitting adjustment के लिए — अगर blazer shoulder पर tight हो तो pattern में क्या change करती हैं?", "timestamp": ts_iso(33.80), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Shoulder seam को थोड़ा बाहर निकालती हूं। Armhole भी adjust होगा साथ में।", "timestamp": ts_iso(33.77), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.78},
            {"speaker": "ai", "text": "Kavita ji, aapka screening complete hua. Aapka score processed ho raha hai — recruiter aapke results review karenge.", "timestamp": ts_iso(33.2), "rubric_tag": None, "acoustic_confidence": None},
        ],
        grounded_questions=[],
        self_awareness_profile={},
        labor_pool_profile={},
        recruiter_decision={},
        phase0_profile={},
        phase0_completed=False,
    ),

    # ── Riyaz: Review Queue — session paused (integrity requires_review) ──────
    SessionDB(
        id="session_riyaz001",
        worker_id="worker_riyaz004",
        worker_name="Mohammed Riyaz",
        assignment="Describe your leather work expertise: tools you use, how you handle edge finishing, skiving technique, and what quality checks you apply before delivering a repaired or custom leather piece.",
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
            "paused once due to a face-absent event, and the proctoring integrity flag is "
            "'requires_review'. Content quality would likely support a 'pass' if integrity is "
            "confirmed. Human review recommended before final placement decision."
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
            "multiface_events": 0, "multiface_resolved": True,
            "face_absent_events": 1, "gaze_deviation_events": 1,
            "face_change_detected": False, "session_paused": True,
            "pause_reason": "face_absent", "overall_flag": "requires_review",
            "integrity_score": 0.5, "last_event_at": ts_iso(21.5),
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
            {"speaker": "ai", "text": "नमस्ते रियाज़ जी! आप leather work में कितने साल से हैं और किस type का काम ज़्यादा करते हैं?", "timestamp": ts_iso(22), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "8 साल से हूं। Bags, belts और shoes repair करता हूं। Custom leather jackets भी बनाता हूं कभी-कभी।", "timestamp": ts_iso(21.97), "rubric_tag": "communication_confidence", "acoustic_confidence": 0.88},
            {"speaker": "ai", "text": "Edge finishing के लिए आप क्या process use करते हैं?", "timestamp": ts_iso(21.93), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "पहले edge को beveller से trim करता हूं। फिर edge paint या beeswax लगाता हूं। फिर burnisher से polish करता हूं जब तक smooth न हो जाए। Thick leather पर multiple coats देता हूं।", "timestamp": ts_iso(21.90), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.90},
            {"speaker": "ai", "text": "Skiving कब और कैसे करते हैं?", "timestamp": ts_iso(21.87), "rubric_tag": None, "acoustic_confidence": None},
            {"speaker": "worker", "text": "Skiving तब करते हैं जब seam join करना हो — thickness कम करते हैं ताकि bulky न हो। Sharp skiving knife use करता हूं, 45-degree angle पर cut करता हूं। Consistent pressure ज़रूरी है otherwise uneven हो जाता है।", "timestamp": ts_iso(21.84), "rubric_tag": "technical_knowledge", "acoustic_confidence": 0.87},
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

JOBS = [
    JobDB(id="job_001", title="Bridal Lehenga — Full Zardozi Embroidery", budget="Rs. 3,500–6,000", skill="Embroidery", urgent=True, location="Mumbai, Maharashtra", description="Seeking an experienced zardozi embroiderer for a bridal lehenga set. 3-metre skirt + blouse. Client wants heavy gold thread work on red silk. Must be able to complete within 10 days. Show sample work.", posted_at=ts(2)),
    JobDB(id="job_002", title="Industrial Stitching — 500 pcs T-Shirt Run", budget="Rs. 35–45 per piece", skill="Industrial Stitching", urgent=False, location="Ludhiana, Punjab", description="Production run of 500 basic crew-neck T-shirts in poly-cotton. Need consistent 1cm seam allowance, overlock finish on all seams. Experience with Juki or Brother industrial machines required.", posted_at=ts(6)),
    JobDB(id="job_003", title="SS26 Collection Pattern Making", budget="Rs. 9,000–14,000", skill="Pattern Making", urgent=True, location="Remote / Chennai", description="Freelance pattern maker needed for a 12-piece SS26 women's collection. Technical flat drawings provided. Must have experience with fitted blazers and wide-leg trousers. Gerber or manual drafting both acceptable.", posted_at=ts(14)),
    JobDB(id="job_004", title="Leather Jacket Restoration x 5", budget="Rs. 1,200–1,800 per piece", skill="Leather Work", urgent=False, location="Hyderabad, Telangana", description="5 vintage leather jackets need full restoration: re-dyeing, edge refinishing, lining replacement, zipper replacement. Client expects showroom-quality finish.", posted_at=ts(20)),
    JobDB(id="job_005", title="Corporate Suit Alterations — 30 pcs", budget="Rs. 3,500 total", skill="Suit Tailoring", urgent=False, location="Bengaluru, Karnataka", description="Batch alteration of 30 corporate suits — trouser hem, jacket sleeve shortening, waist suppression. Delivery within 5 days. Pickup and drop available.", posted_at=ts(28)),
    JobDB(id="job_006", title="Bridal Blouse Fitting Alterations (Urgent)", budget="Rs. 500–800", skill="Alterations", urgent=True, location="Ahmedabad, Gujarat", description="One bridal blouse needs emergency fit alteration — back hook-and-eye relocation and side seam let-out. Wedding in 3 days. Must complete in one sitting.", posted_at=ts(3)),
    JobDB(id="job_007", title="Children's Party Wear — 20 pcs Custom", budget="Rs. 750–950 per piece", skill="Children's Wear", urgent=False, location="Jaipur, Rajasthan", description="20 matching party dresses for a school event. Ages 5–10. Simple A-line design with embroidery trim. Fabric provided. Measurements sheet will be shared. Expected delivery in 2 weeks.", posted_at=ts(48)),
    JobDB(id="job_008", title="Knitwear Repair — Cashmere Collection", budget="Rs. 600–1,200 per piece", skill="Knitwear", urgent=False, location="Delhi NCR", description="Luxury knitwear boutique needs a skilled reweaver for 8 cashmere sweaters with moth damage and snag pulls. Invisible repair expected. Rate per piece based on damage assessment.", posted_at=ts(36)),
]

# ── main ──────────────────────────────────────────────────────────────────────

async def seed():
    print("Initialising database tables...")
    await init_db()

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.ext.asyncio import async_sessionmaker

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as db:
        # Clear existing demo data
        print("Clearing existing demo data...")
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

        # Insert workers
        print(f"Inserting {len(WORKERS)} workers...")
        for w in WORKERS:
            db.add(w)
        await db.commit()

        # Insert sessions
        print(f"Inserting {len(SESSIONS)} sessions...")
        for s in SESSIONS:
            db.add(s)
        await db.commit()

        # Insert jobs
        print(f"Inserting {len(JOBS)} jobs...")
        for j in JOBS:
            db.add(j)
        await db.commit()

    print("\nSeed complete!")
    print("  Workers : Arjun Sharma (Platinum), Priya Mehra (Gold), Kavita Nair (review), Mohammed Riyaz (review)")
    print("  Sessions: 4 completed — 2 pass, 2 in review queue")
    print(f"  Jobs    : {len(JOBS)} live listings seeded")


if __name__ == "__main__":
    asyncio.run(seed())
