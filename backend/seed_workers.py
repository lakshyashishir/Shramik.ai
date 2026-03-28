"""Seed demo worker profiles into the database."""
import asyncio
import os
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.db_models import Base, WorkerDB, SessionDB

DATABASE_URL = os.environ["API_DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def utc(s):
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


WORKERS = [
    {
        "id": "worker_priya_mehra",
        "name": "Priya Mehra",
        "specialization": "Bridal Wear",
        "experience_years": 9,
    },
    {
        "id": "worker_nisha_patel",
        "name": "Nisha Patel",
        "specialization": "Children's Wear",
        "experience_years": 5,
    },
]

SESSIONS = [
    # Priya — session 1 (best)
    {
        "id": "session_priya_001",
        "worker_id": "worker_priya_mehra",
        "worker_name": "Priya Mehra",
        "assignment": "Demonstrate bridal lehenga construction with zardozi embroidery and explain your quality checks.",
        "domain": "garment_tailoring",
        "domain_confidence": 0.97,
        "domain_detection_method": "keyword",
        "status": "completed",
        "started_at": utc("2025-12-01T10:00:00"),
        "ended_at": utc("2025-12-01T10:45:00"),
        "live_score": 91.0,
        "recommendation": "pass",
        "summary": "Priya demonstrates exceptional expertise in bridal wear and zardozi embroidery. Her stitch quality is consistently excellent and she shows deep knowledge of traditional techniques combined with modern finishing standards.",
        "transcript": [],
        "snapshot_feedback": [
            {
                "captured_at": "2025-12-01T10:30:00",
                "quality_score": 91.0,
                "feedback": "Intricate zardozi embroidery — gold thread tension perfect throughout",
                "focus_areas": ["embroidery density", "thread tension"],
                "note": "zardozi panel",
                "image_url": "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80",
            },
            {
                "captured_at": "2025-12-01T10:20:00",
                "quality_score": 93.0,
                "feedback": "Precise measurement snapshot — seam allowance marked at 15mm, consistent across all panels",
                "focus_areas": ["measurement accuracy", "seam marking"],
                "note": "measurement check",
                "image_url": "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&q=80",
            },
        ],
        "rubric_scores": {
            "stitch_quality": 91.0,
            "machine_familiarity": 85.0,
            "technical_knowledge": 88.0,
            "fabric_material_knowledge": 84.0,
            "communication_confidence": 78.0,
        },
        "integrity_log": {"overall_flag": "clear", "integrity_score": 1.0, "face_change_detected": False, "session_paused": False, "multiface_events": 0, "face_absent_events": 0, "gaze_deviation_events": 0},
        "integrity_events": [],
        "current_phase": "passport",
        "self_ratings": {},
        "prior_work_media": [
            {
                "captured_at": "2025-11-20T09:00:00",
                "note": "Wedding collection 2024",
                "vision_summary": "10-piece bridal collection — gota patti and zardozi",
                "relevance_flag": "relevant",
            }
        ],
        "grounded_questions": [],
        "self_awareness_profile": {},
        "assessment_confidence": {},
        "phase0_profile": {"name": "Priya Mehra", "age": 31, "sex": "female", "address": "Jaipur, Rajasthan", "tradeRaw": "Bridal Wear", "yearsExp": 9},
        "phase0_completed": True,
        "portfolio_enrichment": [
            {
                "captured_at": "2025-11-20T09:00:00",
                "note": "Bridal lehenga with mirror work",
                "vision_summary": "Intricate hand-embroidery with gold thread on red dupion silk — ceremonial grade",
                "complexity": "complex",
                "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80",
            },
            {
                "captured_at": "2025-09-05T09:00:00",
                "note": "Saree border embroidery — custom order",
                "vision_summary": "Dense floral motifs along 6m silk border, antique gold thread, zari finish",
                "complexity": "complex",
                "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80",
            },
        ],
        "labor_pool_profile": {},
        "recruiter_decision": {},
        "interview_mode": "web",
    },
    # Priya — session 2
    {
        "id": "session_priya_002",
        "worker_id": "worker_priya_mehra",
        "worker_name": "Priya Mehra",
        "assignment": "Stitch a clean straight seam with consistent margin and explain your quality checks.",
        "domain": "garment_tailoring",
        "domain_confidence": 0.95,
        "domain_detection_method": "keyword",
        "status": "completed",
        "started_at": utc("2025-10-15T10:00:00"),
        "ended_at": utc("2025-10-15T10:40:00"),
        "live_score": 87.0,
        "recommendation": "pass",
        "summary": "Strong performance on seam quality and hemline consistency.",
        "transcript": [],
        "snapshot_feedback": [
            {
                "captured_at": "2025-10-15T10:25:00",
                "quality_score": 88.0,
                "feedback": "Clean hemline with consistent 5mm margin, no fraying visible",
                "focus_areas": ["hem finishing", "edge quality"],
                "note": "hemline check",
                "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
            },
        ],
        "rubric_scores": {
            "stitch_quality": 88.0,
            "machine_familiarity": 84.0,
            "technical_knowledge": 85.0,
            "fabric_material_knowledge": 82.0,
            "communication_confidence": 76.0,
        },
        "integrity_log": {"overall_flag": "clear", "integrity_score": 1.0, "face_change_detected": False, "session_paused": False, "multiface_events": 0, "face_absent_events": 0, "gaze_deviation_events": 0},
        "integrity_events": [],
        "current_phase": "passport",
        "self_ratings": {},
        "prior_work_media": [],
        "grounded_questions": [],
        "self_awareness_profile": {},
        "assessment_confidence": {},
        "phase0_profile": {"name": "Priya Mehra", "age": 31, "sex": "female", "address": "Jaipur, Rajasthan", "tradeRaw": "Bridal Wear", "yearsExp": 9},
        "phase0_completed": True,
        "portfolio_enrichment": [],
        "labor_pool_profile": {},
        "recruiter_decision": {},
        "interview_mode": "web",
    },
    # Nisha — session 1
    {
        "id": "session_nisha_001",
        "worker_id": "worker_nisha_patel",
        "worker_name": "Nisha Patel",
        "assignment": "Stitch a school uniform shirt and explain your process for consistent seam allowance.",
        "domain": "garment_tailoring",
        "domain_confidence": 0.92,
        "domain_detection_method": "keyword",
        "status": "completed",
        "started_at": utc("2026-01-10T10:00:00"),
        "ended_at": utc("2026-01-10T10:35:00"),
        "live_score": 76.0,
        "recommendation": "pass",
        "summary": "Nisha shows solid competency in children's garment production and uniform stitching. She handles multiple fabric types well and demonstrates good process knowledge for small-batch custom orders.",
        "transcript": [],
        "snapshot_feedback": [
            {
                "captured_at": "2026-01-10T10:20:00",
                "quality_score": 76.0,
                "feedback": "School uniform shirt — consistent seam allowance, clean collar attach",
                "focus_areas": ["seam straightness", "collar finish"],
                "note": "collar check",
                "image_url": "https://images.unsplash.com/photo-1619086303291-0ef7699e4b31?w=400&q=80",
            },
        ],
        "rubric_scores": {
            "stitch_quality": 76.0,
            "machine_familiarity": 79.0,
            "technical_knowledge": 72.0,
            "fabric_material_knowledge": 70.0,
            "communication_confidence": 82.0,
        },
        "integrity_log": {"overall_flag": "clear", "integrity_score": 1.0, "face_change_detected": False, "session_paused": False, "multiface_events": 0, "face_absent_events": 0, "gaze_deviation_events": 0},
        "integrity_events": [],
        "current_phase": "passport",
        "self_ratings": {},
        "prior_work_media": [
            {
                "captured_at": "2026-01-10T09:00:00",
                "note": "School uniform contract Jan 2026",
                "vision_summary": "50 sets, cotton blend, standard sizing",
                "relevance_flag": "relevant",
            }
        ],
        "grounded_questions": [],
        "self_awareness_profile": {},
        "assessment_confidence": {},
        "phase0_profile": {"name": "Nisha Patel", "age": 27, "sex": "female", "address": "Surat, Gujarat", "tradeRaw": "Children's Wear", "yearsExp": 5},
        "phase0_completed": True,
        "portfolio_enrichment": [
            {
                "captured_at": "2026-01-10T09:00:00",
                "note": "School uniform batch x50",
                "vision_summary": "Cotton blend shirts and trousers in standard sizes 6–14, flat-felled seams",
                "complexity": "standard",
                "image_url": "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&q=80",
            },
        ],
        "labor_pool_profile": {},
        "recruiter_decision": {},
        "interview_mode": "whatsapp",
    },
]


async def seed():
    async with async_session_maker() as db:
        for w in WORKERS:
            existing = await db.get(WorkerDB, w["id"])
            if existing:
                print(f"Worker {w['name']} already exists, skipping.")
                continue
            db.add(WorkerDB(
                id=w["id"],
                name=w["name"],
                specialization=w["specialization"],
                experience_years=w["experience_years"],
                created_at=datetime.now(timezone.utc),
            ))
            print(f"Created worker: {w['name']} ({w['id']})")

        for s in SESSIONS:
            existing = await db.get(SessionDB, s["id"])
            if existing:
                print(f"Session {s['id']} already exists, skipping.")
                continue
            db.add(SessionDB(**s))
            print(f"Created session: {s['id']}")

        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(seed())
