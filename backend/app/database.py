from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_sessions_schema(conn)


async def _ensure_sessions_schema(conn) -> None:
    """Best-effort additive migrations for local testing databases."""
    required_cols = {
        "domain": "TEXT",
        "domain_confidence": "REAL",
        "domain_detection_method": "TEXT",
        "prior_work_media": "JSON",
        "grounded_questions": "JSON",
        "self_awareness_profile": "JSON",
        "assessment_confidence": "JSON",
        "phase0_profile": "JSON",
        "phase0_completed": "BOOLEAN DEFAULT 0",
        "portfolio_enrichment": "JSON",
        "labor_pool_profile": "JSON",
        "recruiter_decision": "JSON",
    }
    try:
        rows = await conn.execute(text("PRAGMA table_info(sessions)"))
        existing = {str(row[1]) for row in rows}
        for col, col_type in required_cols.items():
            if col in existing:
                continue
            await conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {col} {col_type}"))
    except Exception:
        # Non-SQLite engines can be migrated separately; create_all still works for fresh databases.
        return
