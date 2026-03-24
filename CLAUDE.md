# CLAUDE.md — Shramik.ai

## Project Overview

**Shramik.ai** is a garment-worker skill screening platform. It conducts live AI-driven interviews of tailors/garment workers, evaluates their technical readiness, generates scorecards, and provides an admin dashboard for recruiters to review and override results.

Target users: garment workers (India), recruiters, and factory admins.

---

## Repository Structure

```
microsoft/
├── backend/               # FastAPI Python backend
│   ├── app/
│   │   ├── agents/        # AI interview + scoring logic
│   │   │   ├── interview.py          # Stage definitions (intro/machine/quality/readiness)
│   │   │   ├── scorecard.py          # Rubric dimensions (default/alternate rubric)
│   │   │   ├── screening_logic.py    # Core scoring engine (RUBRIC_WEIGHTS, finalize_session)
│   │   │   └── interview-system.md   # GPT system prompt for the screening agent
│   │   ├── api/routes/
│   │   │   ├── sessions.py   # Session lifecycle endpoints
│   │   │   ├── workers.py    # Worker CRUD endpoints
│   │   │   ├── speech.py     # STT/TTS proxy (Sarvam AI)
│   │   │   └── health.py     # Health check
│   │   ├── integrations/azure/config.py  # Azure dependency check
│   │   ├── services/store.py  # In-memory store (dicts)
│   │   ├── models.py          # All Pydantic models
│   │   ├── config.py          # Settings (env vars)
│   │   └── main.py            # FastAPI app + CORS + router registration
│   ├── tests/test_health.py   # Integration tests
│   └── pyproject.toml
├── frontend/              # React frontend (CRA + CRACO)
│   └── src/
│       ├── pages/
│       │   ├── ScreeningRoomPage.jsx   # Worker-facing interview UI
│       │   ├── AdminDashboardPage.jsx  # Recruiter/admin reporting UI
│       │   ├── WorkersBoardPage.jsx    # Job board (static demo data)
│       │   └── LandingPage.jsx
│       ├── services/api.js    # axios client (all API calls)
│       ├── i18n/language.jsx  # en/hi locale context
│       └── App.js             # Routing, role context, nav
└── infra/azure/           # Azure deployment scaffolding
```

---

## Tech Stack

### Backend
- **Python ≥ 3.10**, FastAPI, Pydantic v2 / pydantic-settings
- **AI**: Azure OpenAI (`gpt-4.1`, `2025-04-01-preview` API version)
- **Speech**: Sarvam AI STT (`saaras:v3`, `hi-IN`) + TTS (`bulbul:v2`, speaker `anushka`)
- **Storage**: In-memory Python dicts (no database — data resets on restart)
- **Server**: Uvicorn

### Frontend
- React (CRA + CRACO), React Router v6, Tailwind CSS, shadcn/ui
- **Vision**: MediaPipe (BlazeFace + HandLandmarker, loaded from Google Storage CDN)
- **Audio**: Web Audio API → WAV encoder (Sarvam requires WAV/MP3, not WebM)
- **i18n**: English + Hindi; locale persisted in `localStorage` key `shramik.ai.locale`

---

## Environment Variables

All backend env vars are prefixed `API_` (set in `.env`):

| Variable | Default | Purpose |
|---|---|---|
| `API_AZURE_OPENAI_ENDPOINT` | `""` | Azure OpenAI endpoint URL |
| `API_AZURE_OPENAI_API_KEY` | `""` | Azure OpenAI API key |
| `API_AZURE_OPENAI_DEPLOYMENT` | `gpt-4.1` | Model deployment name |
| `API_AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` | API version |
| `API_SARVAM_API_KEY` | `""` | Sarvam AI key (STT/TTS) |
| `API_AZURE_SPEECH_KEY` | `""` | Azure Speech (unused currently) |
| `API_AZURE_SPEECH_REGION` | `""` | Azure Speech region (unused currently) |
| `API_AZURE_STORAGE_CONNECTION_STRING` | `""` | Blob storage (unused currently) |
| `API_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |

Frontend: `REACT_APP_BACKEND_URL` (default `http://localhost:8000`)

---

## Data Models

### Worker (`models.py`)
```python
WorkerCreate: name (2-80 chars), specialization (2-120 chars), experience_years (0-50)
Worker: id, name, specialization, experience_years, created_at
```
IDs use format: `worker_<10 hex chars>` (via `new_id("worker")`).

### Session (`models.py`)
```python
Session:
  id, worker_id, worker_name, assignment
  status: "live" | "completed"
  started_at, ended_at
  live_score: float (0-100, starts at 50.0)
  recommendation: "pass" | "hold" | "reject" | "pending"
  summary: str
  transcript: List[TranscriptItem]
  snapshot_feedback: List[SnapshotFeedback]
  rubric_scores: Dict[str, float]
  integrity_log: IntegrityLog
  integrity_events: List[IntegrityEvent] (capped at 200)
  current_phase: str (starts "intro")
  self_ratings: Dict[str, float]
```
Session IDs: `session_<10 hex chars>`.
Assignment field: 8–400 characters.
Worker response per turn: 1–600 characters.

### TranscriptItem
```python
speaker: "ai" | "worker" | "system"
text, timestamp
rubric_tag: Optional[str]
acoustic_confidence: Optional[float]
```

---

## API Endpoints

All routes prefixed with `/api`:

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check → `{"ok": true}` |
| POST | `/workers` | Create worker |
| GET | `/workers` | List workers (sorted newest-first) |
| POST | `/sessions/start` | Start screening session |
| POST | `/sessions/{id}/turn` | Submit worker response, get AI reply |
| POST | `/sessions/{id}/snapshot` | Submit photo for quality scoring |
| POST | `/sessions/{id}/integrity/event` | Report proctoring event |
| POST | `/sessions/{id}/complete` | Finalize session, generate scorecard |
| GET | `/session/{id}` | Get session by ID |
| GET | `/sessions/live` | List live sessions |
| GET | `/sessions/reports` | List completed sessions |
| POST | `/speech/stt` | Audio → transcript (Sarvam STT proxy) |
| POST | `/speech/tts` | Text → audio WAV (Sarvam TTS proxy) |

---

## Business Rules & Scoring Logic

### Interview Phases (defined in `interview-system.md`)

1. **intro** — Background, location, years of experience, specialty, tool availability. Move after 4–5 exchanges.
2. **technical** — Machine setup, defect diagnosis, process sequencing. Ask 3–5 questions. Tag each answer to a rubric.
3. **task** — Worker performs stitching task and uploads a photo. `rubric_tag = stitch_quality`.
4. **passport** — Interview complete. Generate Shramik Passport message.

**Language rule**: Default Hindi. Switch to English only if worker responds in English. Hinglish is acceptable.

### Score Delta Rules (per AI turn, `screening_logic.py`)
Per GPT response, `score_delta` is clamped to `[-8.0, +8.0]`:
- `+6 to +8`: detailed, technically correct, specific answer
- `+3 to +5`: adequate with some correct detail
- `+1 to +2`: vague or partial answer
- `0`: off-topic or no real answer
- `-2 to -4`: wrong information or significant gap
- `-5 to -8`: completely incorrect or evasive

Live score formula: `new_score = clamp(live_score + score_delta, 0, 100)`

### Snapshot Scoring
When a photo is submitted (`/snapshot`):
- **With image**: GPT-4o vision scores stitch/hem quality 0–100 (strict: poor finishing < 50, neat 70–85, excellent 85+)
- **Fallback** (no image or vision fails): `quality_score = clamp(current_score + 5, 30, 85)`
- Focus areas: default `["seam straightness", "edge finishing"]`; if "collar" or "curve" in note → `["curve control", "seam consistency"]`
- Live score update on snapshot: `new_live_score = (live_score × 0.85) + (snapshot_score × 0.15)`

### Final Scoring (`finalize_session` in `screening_logic.py`)

#### Rubric Weights
| Rubric | Weight |
|---|---|
| `stitch_quality` | 0.32 |
| `machine_familiarity` | 0.26 |
| `technical_knowledge` | 0.24 |
| `fabric_material_knowledge` | 0.12 |
| `communication_confidence` | 0.06 |

#### Scoring Steps
1. GPT-4o evaluates full transcript → per-rubric scores 0–100
2. **Snapshot bonus**: `stitch_quality += last_snapshot.quality_score × 0.1` (capped at 100)
3. Weighted overall: `Σ(rubric_score × weight)`
4. **Integrity blend**: `overall = overall × 0.94 + integrity_compliance × 0.06`
5. `integrity_compliance = integrity_score × 100`

#### GPT Scoring Guide (transcript evaluation)
- < 40: poor/no knowledge
- 40–60: basic
- 61–75: competent
- 76–90: strong
- 91+: expert
- Vague or one-word answers → 20–40 (never inflate)

#### Recommendation Logic
- **`critical_flag`** integrity → always `reject`, regardless of score
- Otherwise: use LLM recommendation if valid (`pass`/`hold`/`reject`); fallback:
  - `overall >= 75` → `pass`
  - `overall >= 50` → `hold`
  - otherwise → `reject`

---

## Integrity / Proctoring Rules

Powered by MediaPipe (BlazeFace + HandLandmarker) in the browser. Events sent to `/sessions/{id}/integrity/event`.

### Event Types & Severity
| Event | Severity | Effect |
|---|---|---|
| `multi_face_warning` | warning | Increments `multiface_events`, sets `multiface_resolved=False` |
| `multi_face_resolved` | info | Sets `multiface_resolved=True` |
| `multi_face_pause` | warning | Pauses session, `pause_reason="multiface"` |
| `face_absent` | warning | Increments `face_absent_events`, pauses session, `pause_reason="face_absent"` |
| `gaze_away` | warning | Increments `gaze_deviation_events` |
| `face_change` | **critical** | Sets `face_change_detected=True`, pauses session, `pause_reason="face_change"` |
| `resume` | info | Unpauses; if no `face_change`, also sets `multiface_resolved=True` |

### Integrity Score Computation (`_recompute_integrity`)
| Condition | `overall_flag` | `integrity_score` |
|---|---|---|
| `face_change_detected=True` | `critical_flag` | 0.2 |
| `session_paused=True` | `requires_review` | 0.5 |
| Any events > 0 (multiface/gaze/absent) | `minor_warning` | 0.85 |
| No issues | `clear` | 1.0 |

### Face Change Detection Algorithm (`ScreeningRoomPage.jsx`)
A **face signature** is built from:
- Eye distance between left/right eye keypoints
- Bounding box aspect ratio and area
- Nose position normalized to eye-distance

Face change score (0–1) is a weighted combination of differences vs. baseline:
- Eye distance diff: weight 0.15
- Aspect ratio diff: weight 0.20
- Area diff: weight 0.10
- Nose X normalized diff: weight 0.30
- Nose Y normalized diff: weight 0.25

Multi-face warning triggers after **3000ms** (`MULTIFACE_WARNING_MS`). Integrity polling: every **500ms** (`INTEGRITY_POLL_MS`).

---

## Frontend Role & Navigation

Three roles defined in `App.js`:
| Role | Color | Nav Access |
|---|---|---|
| `worker` | blue `#2563eb` | `/screening`, `/jobs` |
| `recruiter` | purple `#7c3aed` | `/jobs` |
| `admin` | teal `#0f766e` | `/admin` |

Default role on load: `recruiter`. Role is purely client-side (no auth).

Navigation is hidden on `/screening` (full-screen interview mode). Language toggle shown instead.

### Admin Dashboard (`AdminDashboardPage.jsx`)
- Polls API every **8 seconds** for live sessions, reports, and workers
- Falls back to hardcoded `DUMMY_REPORTS` / `DUMMY_LIVE` if API returns empty
- **Human override**: Admins can override AI recommendation (pass/hold/reject). Override is client-side only (not persisted to backend).
- Rubric color thresholds: ≥ 75 green, ≥ 50 amber, < 50 red

### Screening Room (`ScreeningRoomPage.jsx`)
- **WAV encoder**: Converts WebM audio to mono WAV before sending to Sarvam STT
- MediaPipe models loaded from Google Storage CDN URLs at runtime
- Default worker: `{ specialization: "Industrial Stitching", experience_years: 2 }`
- Default assignment: `"Stitch a clean straight seam with consistent margin and explain your quality checks."`

---

## Speech Integration (Sarvam AI)

- **STT endpoint**: `https://api.sarvam.ai/speech-to-text` — model `saaras:v3`, language `hi-IN`, timeout 60s
- **TTS endpoint**: `https://api.sarvam.ai/text-to-speech` — model `bulbul:v2`, speaker `anushka`, preprocessing enabled, timeout 30s
- Auth header: `api-subscription-key`
- STT returns: `{ transcript, language_code }`
- TTS returns WAV audio bytes (decoded from base64 `audios[0]`)
- If `sarvam_api_key` is not configured → HTTP 503

---

## Alternate Rubric (scorecard.py)

`scorecard.py` defines a `DEFAULT_RUBRIC` (different from the live weights in `screening_logic.py`):
| Key | Weight | Description |
|---|---|---|
| `process_knowledge` | 0.30 | Sequence, setup, garment process steps |
| `defect_awareness` | 0.25 | Recognizing stitch defects and quality issues |
| `instruction_following` | 0.20 | Following instructions, working under supervision |
| `communication` | 0.10 | Clarity of answers in selected language |
| `vision_evidence` | 0.15 | Sewing media evidence from the vision lane |

> Note: `scorecard.py` and `interview.py` define alternate/legacy structures not yet wired into the live scoring pipeline. Active scoring uses `RUBRIC_WEIGHTS` in `screening_logic.py`.

---

## Testing

Test file: `backend/tests/test_health.py`

Uses `fastapi.testclient.TestClient`. The integration test (`test_worker_and_session_flow`) covers the full happy path:
1. Create worker
2. Start session
3. Submit a turn
4. Submit snapshot
5. Send `multi_face_warning` event → assert `multiface_events == 1`
6. Send `multi_face_resolved` → assert `multiface_resolved == True`
7. Complete session → assert `status == "completed"` and `integrity_compliance` in `rubric_scores`

Run tests:
```bash
cd backend
pip install -e .[dev]
pytest
```

---

## Development Commands

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .[dev]
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

---

## Important Constraints & Gotchas

1. **In-memory store only** — `workers` and `sessions` are plain Python dicts in `store.py`. All data is lost on backend restart.
2. **Session turns rejected if status != "live"** — all turn/snapshot/integrity endpoints return HTTP 400 if session is completed.
3. **Completing a session is idempotent** — calling `/complete` on an already-completed session returns 200 with existing session (no re-evaluation).
4. **Score_delta is clamped** server-side to `[-8, +8]` regardless of what GPT returns.
5. **Integrity events capped at 200** per session (`[-200:]` slice).
6. **No authentication** — the system has no login/JWT. Role selection is UI-only.
7. **Human overrides are ephemeral** — stored only in React state (`useState`), not persisted to backend.
8. **Admin dashboard polls every 8s** — not real-time WebSocket.
9. **Sarvam STT expects WAV/MP3** — the frontend encodes WebM → mono 16-bit WAV before upload.
10. **GPT temperature**: 0.3 for turns, 0.2 for final evaluation (more deterministic for scoring).
11. **Opening question is hardcoded Hindi** — `choose_opening_question()` always returns a Hindi greeting regardless of locale param.
12. **Workers Board is static demo data** — `WorkersBoardPage.jsx` has no backend integration; all tailors/jobs are hardcoded.
