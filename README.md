# Shramik.ai

**Demo:** https://www.youtube.com/watch?v=XsCu-2khDyM

Shramik.ai screens informal sector workers through live AI-driven interviews and issues a verified Skill Passport. Recruiters get a ranked list of candidates with scores, rubric breakdowns, and portfolio evidence. No middlemen.

Supports garment, electrical, carpentry, food service, and beauty trades. Works over web, WhatsApp, and phone calls.

---

## How it works

1. Worker starts a screening session (web or phone)
2. An AI agent conducts a structured interview across four phases: intro, technical, task, and passport
3. MediaPipe monitors the session for proctoring violations in the browser
4. On completion, GPT-4o evaluates the full transcript and assigns rubric scores
5. A Karma score (0-1000) is computed from six components: skill, integrity, reputation, reliability, growth, and community
6. The worker receives a Skill Passport with a tier (Bronze, Silver, Gold, Platinum)
7. Borderline cases are routed to a human review queue before reaching recruiters

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 async |
| AI | Azure OpenAI GPT-4.1 |
| Speech | Sarvam AI (saaras:v3 STT, bulbul:v2 TTS) |
| Proctoring | MediaPipe BlazeFace + HandLandmarker (browser) |
| Frontend | React, Tailwind CSS, shadcn/ui |
| Database | Azure Database for PostgreSQL |
| Storage | Azure Blob Storage |

---

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

Create a `backend/.env` file with the following:

```
API_AZURE_OPENAI_ENDPOINT=
API_AZURE_OPENAI_API_KEY=
API_AZURE_OPENAI_DEPLOYMENT=gpt-4.1
API_AZURE_OPENAI_API_VERSION=2025-04-01-preview
API_SARVAM_API_KEY=
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
```

The API starts at `http://localhost:8000`. Docs available at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm start
```

Set `REACT_APP_BACKEND_URL=http://localhost:8000` in `frontend/.env.local` if needed.

---

## Karma scoring

Every worker gets a Karma score from 0 to 1000 built from six components: skill (300 pts), integrity (200), reputation (200), reliability (150), growth (100), and community (50). Skill is weighted by how the interview was conducted — a full web session with camera counts more than a phone call. Reputation comes from employer star ratings after a hire. Growth counts how many rubric dimensions the worker has genuinely mastered across all their sessions, not just their best one. The final score runs through an anomaly check that flags suspicious patterns (identical scores across sessions, a burst of completions in 48 hours, critical proctoring violations paired with unusually high scores) and applies a small penalty before the tier is assigned.

---

## Key endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/sessions/start` | Start a screening session |
| POST | `/api/sessions/{id}/turn` | Submit a worker response, get next question |
| POST | `/api/sessions/{id}/complete` | Finalize session and generate scorecard |
| GET | `/api/workers/{id}/karma` | Full Karma breakdown with anomaly signals |
| GET | `/api/passport/{id}` | Public Skill Passport |
| POST | `/api/jobs/{id}/apply` | Worker applies to a job |
| POST | `/api/jobs/{id}/rate` | Employer rates a worker |
| GET | `/api/review/queue` | Sessions pending human review |
| POST | `/api/review/{id}/decision` | Submit reviewer decision |

---

## Phone / IVR mode

Sessions can be conducted over a phone call via Exotel. The call mode uses the same scoring pipeline with adjusted channel multipliers.

Required env vars for call mode:

```
API_EXOTEL_ENABLED=true
API_EXOTEL_ACCOUNT_SID=
API_EXOTEL_API_KEY=
API_EXOTEL_API_TOKEN=
API_EXOTEL_CALLER_ID=
API_EXOTEL_APP_ID=
API_PUBLIC_BASE_URL=https://your-public-backend-host
```

---

## Running tests

```bash
cd backend
pytest
```
