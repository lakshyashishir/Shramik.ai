# Shramik.ai

Shramik.ai is a garment-worker screening platform designed to evaluate tailoring readiness through guided assessment, live interaction, and recruiter review.

## Repository structure

- `frontend/`: React application for the landing page, screening room, and operations dashboard
- `backend/`: FastAPI application for workers, sessions, scoring, and integration logic
- `infra/azure/`: infrastructure scaffolding for Azure deployment
- `.github/workflows/`: CI workflow definitions

## Local development

### Frontend

```bash
cd frontend
npm install
npm start
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
```
