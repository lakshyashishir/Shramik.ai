from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_healthcheck() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_worker_and_session_flow() -> None:
    worker = client.post(
        "/api/workers",
        json={
            "name": "Rekha Devi",
            "specialization": "Industrial Stitching",
            "experience_years": 3,
        },
    )
    assert worker.status_code == 200
    worker_id = worker.json()["id"]

    session = client.post(
        "/api/sessions/start",
        json={
            "worker_id": worker_id,
            "assignment": "Stitch a clean straight seam with consistent margin and explain your quality checks.",
        },
    )
    assert session.status_code == 200
    session_id = session.json()["session"]["id"]

    turn = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"worker_text": "I first check needle, thread tension, and fabric alignment."},
    )
    assert turn.status_code == 200

    snapshot = client.post(
        f"/api/sessions/{session_id}/snapshot",
        json={
            "image_data": "data:image/jpeg;base64," + ("a" * 40),
            "note": "Worker showing seam line and edge finish",
        },
    )
    assert snapshot.status_code == 200

    completed = client.post(f"/api/sessions/{session_id}/complete")
    assert completed.status_code == 200
    assert completed.json()["session"]["status"] == "completed"
