import json
import sqlite3
from pathlib import Path

from app.models import Session, Worker

DB_PATH = Path(__file__).resolve().parents[2] / "shramik_demo.db"

workers: dict[str, Worker] = {}
sessions: dict[str, Session] = {}


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_store() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS workers (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                started_at TEXT NOT NULL,
                status TEXT NOT NULL
            )
            """
        )
        con.commit()
    load_into_memory()


def load_into_memory() -> None:
    workers.clear()
    sessions.clear()
    with _conn() as con:
        for row in con.execute("SELECT data FROM workers ORDER BY created_at DESC"):
            obj = Worker.model_validate(json.loads(row["data"]))
            workers[obj.id] = obj
        for row in con.execute("SELECT data FROM sessions ORDER BY started_at DESC"):
            obj = Session.model_validate(json.loads(row["data"]))
            sessions[obj.id] = obj


def save_worker(worker: Worker) -> None:
    workers[worker.id] = worker
    payload = worker.model_dump_json()
    with _conn() as con:
        con.execute(
            """
            INSERT INTO workers (id, data, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data=excluded.data,
                created_at=excluded.created_at
            """,
            (worker.id, payload, worker.created_at),
        )
        con.commit()


def save_session(session: Session) -> None:
    sessions[session.id] = session
    payload = session.model_dump_json()
    with _conn() as con:
        con.execute(
            """
            INSERT INTO sessions (id, data, started_at, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data=excluded.data,
                started_at=excluded.started_at,
                status=excluded.status
            """,
            (session.id, payload, session.started_at, session.status),
        )
        con.commit()


def get_worker(worker_id: str) -> Worker | None:
    return workers.get(worker_id)


def list_workers() -> list[Worker]:
    return sorted(workers.values(), key=lambda item: item.created_at, reverse=True)


def get_session(session_id: str) -> Session | None:
    return sessions.get(session_id)


def list_live_sessions() -> list[Session]:
    return [s for s in sessions.values() if s.status == "live"]


def list_completed_sessions() -> list[Session]:
    return [s for s in sessions.values() if s.status == "completed"]
