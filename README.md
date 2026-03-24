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

## Exotel Call Mode

Umang's IVR module is exposed through backend call endpoints and reads its Exotel setup from `backend/.env`.

Required env vars:

```bash
API_PUBLIC_BASE_URL=https://your-public-backend-host
API_EXOTEL_ENABLED=true
API_EXOTEL_ACCOUNT_SID=...
API_EXOTEL_API_KEY=...
API_EXOTEL_API_TOKEN=...
API_EXOTEL_API_HOST=api.in.exotel.com
API_EXOTEL_CALLER_ID=...
API_EXOTEL_APP_ID=...
# or set API_EXOTEL_APP_FLOW_URL directly
```

Main endpoints:

- `POST /api/calls/exotel/start`: creates a call-mode session and asks Exotel to place the outbound screening call
- `POST /api/calls/exotel/session`: bootstraps an inbound or Exotel-managed call into a Shramik session
- `POST /api/calls/exotel/turn`: sends transcript text from the active call and returns the next AI prompt
- `GET|POST /api/calls/exotel/status`: Exotel status callback for call SID, duration, and recording URL
- `POST /api/calls/exotel/complete`: finalizes the call interview and computes the report with call-mode scoring

Call-mode sessions are stored with `interview_mode: "call"` and use the rebalanced rubric weights from the blueprint.
