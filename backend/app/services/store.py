from app.models import Session, Worker

workers: dict[str, Worker] = {}
sessions: dict[str, Session] = {}
call_session_index: dict[str, str] = {}
