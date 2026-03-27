# Shramik.ai — Development Blueprint v3
### Team BitNova | Microsoft AI Unlocked Hackathon
### Next-Phase Build Plan

---

## Team Ownership

| Module | Owner(s) | Responsibility |
|---|---|---|
| Frontend, Mobile, Onboarding, i18n, Deck | @Srija (1 GT IITR) + @Bipasha | React UI, voice onboarding flow, responsive design, locale strings, pitch deck |
| Karma System | @Lakshya | Karma engine, tier scoring, anomaly detection, reputation pipeline |
| ML Systems & Azure Integrations | @Lassi (GPT IITR) | HITL review queue, LLM routing, Azure Cosmos DB + Blob migration, scoring pipeline |
| Mobile Call Support, Multilingual Models, Vision Agent | @Umang | IVR/WhatsApp channels, offline Phi-3.5 ONNX, photo cross-questioning vision agent |

---

## 1. ARCHITECTURE OVERVIEW

```
+-------------------------------------------------------------+
|                      CHANNEL LAYER                          |
+------------------+-------------------+---------------------+
|  WEB APP (PWA)   |   WHATSAPP BOT    |   VOICE CALL (IVR)  |
|  React + Vite    |  Sarvam Samvaad   |  Azure ACS + ART    |
|  @Srija @Bipasha |     @Umang        |       @Umang        |
+--------+---------+----------+--------+----------+----------+
         |                    |                   |
+--------v--------------------v-------------------v----------+
|              SPEECH LAYER (Sarvam AI — integrated)         |
|         STT: saaras:v3   <->   TTS: bulbul:v2 (anushka)   |
+------------------------------+-----------------------------+
                               |
+------------------------------v-----------------------------+
|                   LLM ROUTING LAYER  @Lassi                |
|  Strong signal  ->  Azure OpenAI GPT-4.1 (current)        |
|  Weak signal    ->  Phi-4-mini-instruct (Azure AI Foundry) |
|  Offline        ->  Phi-3.5-mini ONNX (on-device) @Umang  |
+------------------------------+-----------------------------+
                               |
+------------------------------v-----------------------------+
|         SCORING ENGINE  @Lassi + @Lakshya                  |
|  Rubric scores | Karma computation | Anomaly detection     |
|  Confidence >= 0.80  -> recruiter dashboard (auto)         |
|  Confidence 0.55-0.79 -> human review queue               |
|  Confidence < 0.55   -> mandatory review + re-interview    |
+--------+------------------+---------------------------------+
         |                  |
+--------v--------+ +-------v---------------------------------+
| RECRUITER DASH  | |   HUMAN REVIEW QUEUE  @Lassi            |
| AdminDashboard  | |   New page — next-day SLA              |
+-----------------+ +-----------------------------------------+
                               |
+------------------------------v-----------------------------+
|                      DATA LAYER  @Lassi                    |
|  In-Memory (current)  ->  Azure Cosmos DB (production)    |
|  Azure Blob Storage (photos, recordings, transcripts)     |
|  Karma Store | Passport Store | Review Log                |
+------------------------------------------------------------+
```

### Current Stack (What Exists Today)
- **Backend**: FastAPI, in-memory store (`services/store.py`), Azure OpenAI GPT-4.1
- **Frontend**: React (CRA + CRACO), Tailwind, shadcn/ui, MediaPipe (face/hand)
- **Speech**: Sarvam AI STT (`saaras:v3`) + TTS (`bulbul:v2`, speaker `anushka`)
- **Scoring**: `screening_logic.py` — rubric weights, `finalize_session`, integrity blend

---

## 2. MODULE 1 — FRONTEND, UX & DECK
### @Srija (1 GT IITR) + @Bipasha

### 2.1 Voice Onboarding (Zero-Keyboard Flow)

**Goal:** Demo starts with a blank screen. Worker speaks name + trade. Profile populates. Nothing is typed.

**Current state:** Worker name/specialization are entered via form fields in `ScreeningRoomPage.jsx`.

**What to build:**

```
VoiceOnboarding component flow:
1. Mount -> play Hindi welcome via Sarvam TTS
   "Namaste! Main aapka Shramik Mitra hun. Apna naam aur kaam batayein."

2. Pulsing mic button -> MediaRecorder -> WAV encoding (reuse existing encoder
   in ScreeningRoomPage.jsx) -> Sarvam STT -> transcript

3. POST /api/workers/onboard (new endpoint, or reuse POST /workers)
   Backend calls GPT-4.1 to extract: name, trade, experience_years from Hindi text
   Returns worker_id

4. Confirm via TTS: "Aapka naam [name] register ho gaya. Interview shuru karein?"

5. Navigate -> /screening?worker_id=...
```

**Files to modify:**
- `frontend/src/pages/ScreeningRoomPage.jsx` — add voice onboarding phase before interview starts
- `frontend/src/services/api.js` — add `onboardWorkerByVoice()` call
- `backend/app/api/routes/workers.py` — add voice onboarding endpoint

**Demo X-Factor:** "Nothing gets typed in this entire demo."

---

### 2.2 Mobile Responsive Design

**Target devices:** Android 8.0+ with 3GB RAM, 360px–420px viewport width

**Priority fixes:**
- `ScreeningRoomPage.jsx` — interview room must be usable on 5.5" Android screen
- `AdminDashboardPage.jsx` — card grid should stack to single column on mobile
- All modals/overlays must be full-screen on mobile (not card-within-card)
- Touch targets minimum 48x48px (mic button, action buttons)
- Font sizes: minimum 16px body, 14px labels (no tiny text)

**Tailwind breakpoint plan:**
```
sm: (640px) — tablet landscape
Default: mobile-first (360px baseline)
All grid layouts: grid-cols-1 default, md:grid-cols-2, lg:grid-cols-3
```

**Files to modify:**
- `frontend/src/pages/ScreeningRoomPage.jsx`
- `frontend/src/pages/AdminDashboardPage.jsx`
- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/pages/WorkersBoardPage.jsx`

---

### 2.3 i18n — Frontend Text Strings

**Current state:** `frontend/src/i18n/language.jsx` — English + Hindi locale context, persisted in `localStorage` key `shramik.ai.locale`.

**What to add/expand:**

```javascript
// Priority strings to add to both en and hi locales:

// Onboarding
"onboarding.welcome": "Namaste! Apna naam aur kaam batayein." / "Welcome! Tell us your name and trade."
"onboarding.confirm": "Aapka naam {name} register ho gaya." / "Your name {name} has been registered."
"onboarding.start": "Interview shuru karein?" / "Ready to start your interview?"

// Interview room
"interview.listening": "Sun raha hun..." / "Listening..."
"interview.processing": "Aapka jawab sun raha hun..." / "Processing your answer..."
"interview.photo_prompt": "Apne kaam ki photo bhejiye." / "Upload a photo of your work."

// Passport
"passport.tier.bronze": "Bronze" / "Bronze"
"passport.tier.silver": "Silver" / "Silver"
"passport.tier.gold": "Gold" / "Gold"
"passport.tier.platinum": "Platinum" / "Platinum"
"passport.karma": "Karma Score" / "Karma Score"
"passport.share": "Passport share karein" / "Share Passport"

// Errors / Fallbacks
"error.voice_unavailable": "Voice kaam nahi kar raha. Yahan type karein." / "Voice unavailable. Type here."
"error.photo_failed": "Photo upload nahi hua. Dobara try karein." / "Photo upload failed. Try again."

// Admin dashboard
"admin.override": "Override karein" / "Override AI Decision"
"admin.review_pending": "Review baaki hai" / "Pending Review"
```

**Files to modify:**
- `frontend/src/i18n/language.jsx` — add all new string keys

---

### 2.4 Skill Passport UI Component

**New component: `PassportCard.jsx`**

```
Shows:
- Worker photo (or avatar fallback)
- Name + Trade
- Tier badge (Bronze / Silver / Gold / Platinum) — animated reveal
- Karma score (0-1000) with progress ring
- Rubric radar chart (5 dimensions)
- GPT-generated narrative (3 sentences, Hindi + English)
- QR code for shareable URL
- Integrity status badge (clear / minor_warning / requires_review / critical_flag)
- Assessment channel badge (Web Full / WhatsApp / Call)

Animated tier reveal: starts as "Bronze" with glow animation,
transitions up on score display. "Aapko Gold Passport mila!"
```

**Files to create:**
- `frontend/src/components/PassportCard.jsx`

---

### 2.5 Pitch Deck Structure

**Slide order (8 slides, 5 minutes):**

1. **The Invisible Worker** — 400M informal workers. Real skills. No proof. One photo of Ramu.
2. **Why Existing Platforms Fail** — Apna/LinkedIn assume literacy. Contractor system. The thekedar.
3. **The Shramik Solution** — 3-Evidence Framework. Voice-first. Zero keyboard.
4. **Live Demo** — X-Factor moments 1-4 (voice onboarding, adaptive AI, integrity breach, photo cross-questioning)
5. **The Skill Passport** — Two passports side-by-side. 12-year vs 2-year carpenter.
6. **Karma Flywheel** — Assessment → Job → Rating → Better job → Smarter model. The moat.
7. **Architecture** — Channel layer, LLM routing, Azure stack. SLMs on-device.
8. **The Ask** — Scale to 8 trades. 3 factory pilots. The Skill Passport for India's invisible workers.

**Key lines per slide are in `SHRAMIK_AI_PLAN .md` Section 5 (X-Factors).**

---

## 3. MODULE 2 — KARMA SYSTEM
### @Lakshya

### 3.1 Karma Score Architecture

```
Assessment Score (300 pts max)   -> skill_score * 300
Integrity Score  (200 pts max)   -> integrity_compliance * 200
Reputation Score (200 pts max)   -> employer_ratings average * 200
Reliability Score (150 pts max)  -> job_completion_rate * 150
Growth Score     (100 pts max)   -> learning_activity * 100
Community Score  (50 pts max)    -> referrals * 50
                                  -------------------------
TOTAL KARMA                       0 – 1000
```

### 3.2 Passport Tiers

| Karma Range | Tier | Access Level |
|---|---|---|
| 0 – 299 | Bronze | Basic job board |
| 300 – 599 | Silver | Priority listing, more job visibility |
| 600 – 799 | Gold | Featured placements, premium employers |
| 800 – 1000 | Platinum | Top-tier employers, verified showcase |

### 3.3 Assessment Channel Multipliers

Skill score is multiplied by channel quality before feeding into karma:

| Channel | Multiplier | Reason |
|---|---|---|
| Web full (camera + voice) | 1.0x | Full multimodal signal |
| Web no camera | 0.85x | No vision evidence |
| WhatsApp bot | 0.75x | Compressed images, async turns |
| IVR voice call | 0.60x | No vision, telephony audio quality |
| Offline (Phi-3.5 ONNX) | 0.90x (post-sync) | Same rubrics, lower model quality |

### 3.4 KarmaEngine — Backend Implementation

**New file: `backend/app/agents/karma_engine.py`**

```python
KARMA_WEIGHTS = {
    'skill_score': 0.30,       # from finalize_session() rubric scores
    'integrity_score': 0.20,   # from IntegrityLog.integrity_score
    'reputation_score': 0.20,  # from employer ratings (post-job)
    'reliability_score': 0.15, # job completion rate
    'growth_score': 0.10,      # learning topics mastered
    'community_score': 0.05,   # referrals
}

CHANNEL_MULTIPLIER = {
    'app_full': 1.0,
    'app_no_camera': 0.85,
    'whatsapp': 0.75,
    'ivr_call': 0.60,
    'offline_synced': 0.90,
}

ANOMALY_SIGNALS = [
    '5_stars_from_10_employers_in_7_days',
    'multiple_accounts_same_device',
    'employer_and_worker_same_day',
    'karma_jump_over_200_in_48_hours',
    'all_ratings_exactly_5_same_ip_range',
]

def compute_karma(worker_id: str) -> int:
    # 1. Fetch all component scores
    # 2. Apply channel multiplier to skill_score
    # 3. Weighted sum -> raw_karma (0-1000)
    # 4. Run anomaly detection (IsolationForest or rule-based)
    # 5. If anomaly: route to human audit queue, apply penalty
    # 6. Return final karma int
    pass

def get_passport_tier(karma: int) -> str:
    if karma >= 800: return 'Platinum'
    if karma >= 600: return 'Gold'
    if karma >= 300: return 'Silver'
    return 'Bronze'

def generate_passport_narrative(worker_data: dict) -> str:
    # Call GPT-4.1: 3-sentence summary, English + Hindi
    # "Ramesh is a Gold-tier carpenter with 12 years experience..."
    pass
```

### 3.5 New API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/workers/{id}/karma` | Get computed karma score + tier |
| GET | `/api/passport/{id}` | Public passport (karma, rubrics, narrative, QR) |
| POST | `/api/workers/{id}/knowledge-tags` | Add mastered topic (Apna Ustaad integration) |
| POST | `/api/jobs/{id}/apply` | One-tap apply (sends passport ID) |
| POST | `/api/jobs/{id}/rate` | Employer rates worker (post-job) |
| POST | `/api/employers/{id}/rate` | Worker rates employer (post-job) |

### 3.6 Employer Karma (Two-Way Rating)

Every employer has a karma score just like workers. Workers see it before applying.

```
Employer card shows:
"Is employer ne 847 workers hire kiye hain. Rating: 4.2/5.
 Tags: On-time payment, Good conditions."

Red flag threshold (<3.0): Banner — "Caution: Multiple workers reported wage mismatch."
```

**Files to create/modify:**
- `backend/app/agents/karma_engine.py` (new)
- `backend/app/api/routes/karma.py` (new)
- `backend/app/models.py` — add `KarmaScore`, `EmployerRating`, `WorkerRating` models
- `backend/app/services/store.py` — add karma_scores, employer_ratings dicts
- `frontend/src/components/KarmaBadge.jsx` (new)
- `frontend/src/components/PassportCard.jsx` — wire up karma score + tier

---

## 4. MODULE 3 — ML SYSTEMS & AZURE INTEGRATIONS
### @Lassi (GPT IITR)

### 4.1 LLM Routing Layer

Three-tier model cascade based on connectivity signal:

| Level | Trigger | Model | Cost |
|---|---|---|---|
| 1 | Strong signal | Azure OpenAI GPT-4.1 (current) | High, best quality |
| 2 | Weak signal | Phi-4-mini-instruct (Azure AI Foundry) | Low, structured output |
| 3 | Offline | Phi-3.5-mini ONNX on-device | Zero network |

**Backend routing logic (new in `screening_logic.py`):**
```python
def get_llm_client(connectivity_signal: str):
    if connectivity_signal == 'strong':
        return azure_openai_client  # current
    elif connectivity_signal == 'weak':
        return phi4_mini_client     # Azure AI Foundry endpoint
    else:
        return None  # handled client-side by @Umang's offline module
```

**Phi-4-mini-reasoning** for final scoring pass only (not live turns — it's slower due to `<think>` tags). Use Phi-4-mini-**instruct** for live conversational turns.

### 4.2 HITL Confidence Routing

```python
CONFIDENCE_THRESHOLDS = {
    'auto_pass': 0.80,     # ~60% of sessions — recruiter sees immediately
    'review_queue': 0.55,  # ~25% of sessions — human review, next-day SLA
    'mandatory': 0.0,      # ~15% of sessions — re-interview + review
}

def route_session(session: Session) -> str:
    confidence = compute_assessment_confidence(session)
    if confidence >= 0.80:
        return 'auto_forward'
    elif confidence >= 0.55:
        return 'review_queue'
    else:
        return 'mandatory_review'
```

**Assessment confidence factors:**
- LLM scoring consistency across rubrics (low variance = high confidence)
- Integrity flag level (critical_flag = hard route to review)
- Channel type (IVR/WhatsApp lower confidence baseline)
- Self-rating vs. AI score mismatch (>2 band gap = flag)

### 4.3 Human Review Queue — New Page

**New page: `frontend/src/pages/ReviewQueuePage.jsx`**

```
Route: /admin/review

Queue card shows per session:
- Worker name | Trade | Channel badge | Confidence score
- Weak component: "Evidence Quality low — no photo uploaded"
- AI recommendation | Overall score
- [Review ->] button

Inside review view:
- Full transcript with per-turn rubric tags + acoustic_confidence
- AI rubric scores vs. self-ratings side-by-side
- Weak component explanation
- Actions:
  - Approve scores
  - Edit individual rubric score (slider + mandatory note)
  - Request re-interview (sends worker a re-assessment link)
- Time tracking per review (to measure reviewer burden)
```

**New backend endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/api/review/queue` | All sessions pending human review |
| POST | `/api/review/{session_id}/decision` | Submit reviewer decision |
| PATCH | `/api/review/{session_id}/rubric` | Edit single rubric score with note |

**Override log structure (add to `models.py`):**
```python
class ReviewDecision(BaseModel):
    session_id: str
    reviewer_id: str
    original_recommendation: str
    final_recommendation: str
    rubric_edits: Dict[str, float]   # which rubrics changed
    edit_notes: Dict[str, str]       # why they were changed (training data)
    time_spent_seconds: int
    timestamp: datetime
```

### 4.4 Gradual Automation Timeline

| Phase | Threshold | Rule |
|---|---|---|
| Month 0–1 | 100% review | All sessions reviewed. Data collection only. |
| Month 2 | Analysis | Compute per-rubric override rate. Find weak spots. |
| Month 3 | >= 0.75 auto | If rubric has < 10% override rate and confidence high. |
| Month 6 | Web >= 0.75 auto | Call/WhatsApp still reviewed (less signal). |
| Month 12 | Edge cases only | Integrity events, mismatch > 2 bands, confidence < 0.55. |

### 4.5 Azure Infrastructure Migration

**From in-memory to production:**

| Current | Target | Migration Notes |
|---|---|---|
| `store.py` dicts | Azure Cosmos DB (NoSQL) | Worker, Session, KarmaScore collections |
| Local photo handling | Azure Blob Storage | Photos, audio recordings, transcripts |
| No persistence | Azure Container Apps | Uvicorn containerized, auto-scale |

**New config vars needed (`backend/app/config.py`):**
```python
API_COSMOS_CONNECTION_STRING: str = ""
API_COSMOS_DATABASE_NAME: str = "shramik"
API_BLOB_STORAGE_CONNECTION_STRING: str = ""  # already defined, now wire up
API_BLOB_CONTAINER_PHOTOS: str = "work-photos"
API_BLOB_CONTAINER_AUDIO: str = "session-audio"
```

**Files to create/modify:**
- `backend/app/services/store.py` — add Cosmos DB adapter (keep in-memory as fallback)
- `backend/app/config.py` — add Cosmos + Blob vars
- `backend/app/integrations/azure/cosmos.py` (new)
- `frontend/src/pages/ReviewQueuePage.jsx` (new)
- `frontend/src/App.js` — add `/admin/review` route (admin role only)

---

## 5. MODULE 4 — MOBILE CALL SUPPORT, MULTILINGUAL MODELS, VISION AGENT
### @Umang

### 5.1 IVR Voice Call Channel

**Goal:** Feature phone worker dials a number, speaks to AI in Hindi for 12 minutes, gets a Skill Passport.

**Recommended stack:**
- **Primary (judge-friendly):** Azure Communication Services + ART Voice Agent Accelerator (Microsoft open-source)
- **Backup (India-production):** Exotel AgentStream (<20ms latency, DPDPA compliant, Indian PSTN optimized)

**Call flow:**
```
Worker dials toll-free
  -> IVR greeting (Sarvam TTS Hindi)
  -> Worker says name + trade (spoken, no DTMF codes needed)
  -> Session created with interview_mode: "call"
  -> Phases: intro -> technical -> verbal task -> passport
  -> Barge-in supported (worker interrupts AI mid-sentence)
  -> Session timeout: soft warning 12 min, hard cutoff 18 min
  -> Result routed to HITL or recruiter dashboard
```

**Call-mode rubric weights (no camera, no stitch_quality):**

| Rubric | Weight |
|---|---|
| `machine_familiarity` | 0.35 |
| `technical_knowledge` | 0.33 |
| `fabric_material_knowledge` | 0.20 |
| `communication_confidence` | 0.12 |

Phase 3 (task): verbal walkthrough replaces photo — "Agar aapke paas machine hoti, toh aap seam kaise banate — step by step batayein."

**Latency budget:**
| Step | Time |
|---|---|
| Sarvam STT | 400–500ms |
| Phi-4-mini (Azure AI Foundry) | 600–900ms |
| Sarvam TTS | 350–450ms |
| **Total** | **~1.4–1.9 seconds** |

**New backend fields (add to `models.py`):**
```python
class Session(BaseModel):
    # ... existing fields ...
    interview_mode: str = "web"  # "web" | "call" | "whatsapp" | "offline"
    call_phone_number: Optional[str] = None
    call_duration_seconds: Optional[int] = None
```

**Files to create/modify:**
- `backend/app/api/routes/call.py` (new) — IVR webhook endpoints
- `backend/app/models.py` — add `interview_mode` field
- `backend/app/agents/screening_logic.py` — call-mode rubric weight branch
- `frontend/src/pages/AdminDashboardPage.jsx` — show channel badge (Web / Call / WhatsApp)

### 5.2 WhatsApp Bot Channel

**Goal:** Worker with WhatsApp sends voice notes, gets assessed asynchronously. Works on 2G.

**Stack:** Sarvam Samvaad (already integrated for STT/TTS — same API key, native WhatsApp support)
**Backup:** Gupshup WhatsApp Business API or Twilio WhatsApp API

**WhatsApp flow:**
```
Recruiter sends worker a WhatsApp invite link
  -> Worker sends voice note (more natural than typing)
  -> Backend webhook: voice note -> Sarvam STT -> text
  -> LLM generates response (Phi-4-mini weak signal, GPT-4.1 strong)
  -> Sarvam TTS -> audio file -> sent back as voice note reply
  -> Phase 3: worker photos work -> sends via WhatsApp
    (WhatsApp JPEG compression fine — GPT-4.1 Vision handles it)
  -> Session completes -> recruiter sees result with WhatsApp badge
  -> If signal drops mid-interview: WhatsApp queues + delivers on reconnect
```

**What makes WhatsApp powerful:**
- Async-tolerant: interview survives connectivity drops
- Workers can type if voice fails (same backend handles both)
- No app install needed
- ~95% penetration among Indian smartphone users

**New backend endpoints:**
- `POST /api/whatsapp/webhook` — receive WhatsApp messages from provider
- `POST /api/whatsapp/send` — send response back via WhatsApp API

### 5.3 Offline PWA — Phi-3.5 ONNX On-Device

**Goal:** Full assessment works with zero internet. Results sync when connectivity returns.

**Stack:**
| Component | Technology | Size |
|---|---|---|
| STT | Whisper.cpp Android (whisper-tiny) | ~75MB |
| LLM | Phi-3.5-mini-instruct ONNX via ONNX Runtime GenAI | ~2.3GB |
| TTS | Android TextToSpeech API (native) | 0 |
| Storage | IndexedDB + Service Worker | — |

**Offline flow:**
```
[No internet detected by Service Worker]
  -> Offline mode banner shown to worker
  -> STT: Whisper.cpp (real-time streaming, Hindi support)
  -> LLM: Phi-3.5-mini ONNX (6.2 tok/s on Galaxy S21)
  -> TTS: Android native TTS
  -> Transcript + scores saved to IndexedDB
  -> Passport generated locally (shows "pending sync" status)

[Internet returns]
  -> Background sync queue fires
  -> Upload transcript + photos to backend
  -> GPT-4.1 re-scores for validation
  -> If score diff within threshold: offline passport confirmed (0.9x karma)
  -> If significant gap: flag for HITL review
  -> Worker notified via SMS: "Aapka Passport live ho gaya"
```

**Device minimum spec:** Android 8.0+, 3GB RAM. Show incompatible message on devices with <3GB free.

**First-run experience:** Model download (2.3GB) over WiFi with progress bar.
Message: "Pehli baar thoda time lagega. WiFi pe download ho raha hai."

**Three-tier connectivity fallback — core narrative:**
```
Level 1 (strong signal)  -> GPT-4.1          : Best quality + vision
Level 2 (weak signal)    -> Phi-4-mini cloud  : Fast, cheap, structured
Level 3 (offline)        -> Phi-3.5 ONNX      : Zero network, privacy-first
```
Same rubrics. Same passport. Same result quality. Regardless of connectivity.

**Important Phi prompt note:** Phi-3.5-mini has higher prompt sensitivity than GPT-4.1. Scoring prompts need a separate testing pass. SLM-scored sessions are more likely to fall below 0.80 confidence threshold → routed to HITL (correct behavior).

**Files to create:**
- `frontend/src/workers/offlineSync.js` (Service Worker)
- `frontend/src/services/offlineLLM.js` (ONNX Runtime GenAI wrapper)
- `frontend/src/services/offlineSTT.js` (Whisper.cpp WASM wrapper)
- `frontend/public/offline.html` (offline fallback page)

### 5.4 Vision Agent — Photo Cross-Questioning

**Goal:** Worker uploads photo of past work. AI generates 4 targeted questions ONLY answerable by the person who made that work. Scores their answers to verify ownership.

**Current state:** `/snapshot` endpoint scores photo quality (stitch/hem) but does NOT cross-question.

**New pipeline:**

```
Worker uploads photo
  |
POST /api/assessment/analyze-photo
  -> GPT-4.1 Vision: analyze image
  -> Extract: work type, visible details, quality indicators, complexity
  -> Generate 4 cross-questions in Hindi:
     Q1: "Specific visible detail — yeh kaise banaya?"
     Q2: "Process/technique — kaun sa tool use kiya?"
     Q3: "Problem — koi mushkil aayi banate waqt?"
     Q4: "Improvement — ab kya alag karte?"
  -> Return: {questions[], visual_quality_score, work_complexity, observed_features}
  |
For each question:
  -> Play via Sarvam TTS
  -> Record answer -> Sarvam STT -> text
  -> POST /api/assessment/score-answer
     GPT-4.1: score answer specificity vs. what is visible in photo
     Returns: {score, confidence_signal, reasoning}
  |
After all 4 questions -> photo_confidence_score (weighted avg)
  75-100: HIGH_CONFIDENCE (worker almost certainly made this)
  50-74: MEDIUM_CONFIDENCE
  25-49: LOW_CONFIDENCE -> flag for HITL
  0-24: SUSPICIOUS -> route to review queue
```

**Demo X-Factor:** "We don't verify photos. We verify people through photos."

**New backend endpoints:**
- `POST /api/assessment/analyze-photo` — vision analysis + cross-question generation
- `POST /api/assessment/score-answer` — score a single cross-question answer

**Files to create/modify:**
- `backend/app/api/routes/sessions.py` — add vision agent endpoints
- `backend/app/agents/vision_agent.py` (new) — photo analysis + cross-questioning logic
- `frontend/src/components/PhotoEvidence.jsx` (new) — upload + cross-question UI

### 5.5 Trade-Specific Question Trees

Seed data for GPT-4.1 interview branching (already defined in `SHRAMIK_AI_PLAN .md` Section 8.2).
Add to backend as structured system prompt templates per trade:

- **TAILOR/GARMENT** — machine_familiarity, stitch_quality, fabric_knowledge, defect_awareness
- **CARPENTER** — wood_knowledge (30%), joint_finishing (28%), tool_mastery (22%), reading_plans (12%), safety (8%)
- **PLUMBER** — pipe_knowledge (28%), fitting_jointing (26%), pressure_flow (22%), sanitation (14%), safety (10%)
- **ELECTRICIAN** — wiring_knowledge (30%), safety_compliance (25%), fault_diagnosis (22%), load_calculation (13%), tool_handling (10%)

**MANDATORY ELECTRICIAN SAFETY SCENARIO (non-negotiable):**
"Kaam karte waqt wire se spark aaya — aap kya karoge step by step?"
Expected: 1) MCB off 2) Don't touch bare wire 3) Test 4) Report
Any answer skipping step 1 = automatic safety flag regardless of other scores.

**New file: `backend/app/agents/trade_trees.py`** — structured question trees per trade

---

## 6. X-FACTORS — DEMO WOW MOMENTS

| # | Moment | Stage | Owner |
|---|---|---|---|
| 1 | "Nothing gets typed" — voice onboarding | Onboarding | @Srija @Bipasha |
| 2 | Live question adaptation — worker mentions "overlock", next Q adapts | Interview | @Lassi |
| 3 | Photo cross-questioning — AI asks about visible details in photo | Evidence | @Umang |
| 4 | Integrity breach live — second person walks in, session pauses | Monitoring | (existing) |
| 5 | Two passports side-by-side — 12-year vs 2-year carpenter, rubric diff | Scoring | @Lakshya |
| 6 | Apna Ustaad — worker asks "MCB aur RCCB mein kya farak hai?" | Learning | @Lakshya |
| 7 | Employer karma score — 3.2/5, "Late payment", "Wage mismatch" tags | Dashboard | @Lakshya |
| 8 | Karma flywheel — Assessment → Job → Rating → Better job → Smarter model | Closing | All |

---

## 7. CROSS-MODULE INTEGRATION POINTS

### API Contracts Between Modules

| Consumer | Provider | Endpoint | Data |
|---|---|---|---|
| @Srija (Passport UI) | @Lakshya (Karma) | `GET /api/workers/{id}/karma` | karma_score, tier, component breakdown |
| @Srija (Job Board) | @Lakshya (Jobs) | `GET /api/jobs`, `POST /api/jobs/{id}/apply` | filtered jobs, one-tap apply |
| @Lassi (Review Queue) | All | `GET /api/review/queue` | sessions with confidence < 0.80 |
| @Umang (Call mode) | @Lassi (Scoring) | `POST /sessions/{id}/complete` | session with `interview_mode: "call"` |
| @Umang (Offline sync) | @Lassi (Storage) | Cosmos DB + Blob endpoints | transcript, photos, scores |
| @Lakshya (Karma) | @Lassi (Review) | `GET /api/review/{id}/decision` | override_reason, rubric_edits (training data) |

### Session `interview_mode` field

All modules must respect `interview_mode` when routing:
```
"web"       -> full MediaPipe + camera + voice
"call"      -> no camera, rebalanced rubric weights, IVR latency budget
"whatsapp"  -> async turns, compressed photos OK, 2G tolerant
"offline"   -> Phi-3.5 ONNX scores, pending sync, 0.9x karma multiplier
```

---

## 8. SELF-LEARNING BOT — "APNA USTAAD"
### @Lakshya (wire-up) + @Umang (voice layer)

**Goal:** After assessment, worker can ask AI anything about their trade in Hindi. Lifetime career companion.

**Backend: `POST /api/bot/ask`**
```python
Input: {
    question: str,
    worker_trade: str,
    worker_karma_score: int,
    knowledge_tags_earned: List[str],
    conversation_history: List[dict]
}

GPT-4.1 system prompt:
"You are Apna Ustaad — a friendly trade knowledge assistant for informal workers in India.
 Worker trade: {trade} | Skill level: {karma}/1000 ({tier})
 Topics mastered: {knowledge_tags}

 Rules:
 - Answer in simple Hindi using everyday language
 - Use real-world Indian-life analogies
 - Calibrate complexity to skill level
 - After explaining, ask ONE follow-up check question
 - Correct answers: confirm + offer to go deeper
 - Wrong answers: gently correct with explanation
 - Keep responses under 4 sentences unless asked
 - Never shame a worker for not knowing something"
```

**After correct knowledge check answer:**
- `PATCH /api/workers/{id}/knowledge-tags` — add mastered topic
- Growth score += 2 karma points
- Show: "Aaj aapne {topic} seekha. Aapka Karma {old} se {new} ho gaya."

---

## 9. VERIFICATION

### How to Test End-to-End

**1. Backend (existing tests)**
```bash
cd backend
pip install -e .[dev]
pytest  # runs test_health.py happy path
```

**2. Voice onboarding (@Srija)**
- Navigate to `/` or `/screening`
- Tap mic, say "Mera naam Ramu hai, main darzi hun, 12 saal ka experience hai"
- Verify worker profile populates, no text entered

**3. Karma score (@Lakshya)**
```bash
# Create worker + complete session
curl -X POST /api/workers -d '{"name":"Ramu","specialization":"Garment","experience_years":12}'
# Complete session with rubric scores
# GET /api/workers/{id}/karma -> should return {karma_score, tier, breakdown}
```

**4. HITL review queue (@Lassi)**
- Complete a session with low confidence signals (vague answers, gaze events)
- Navigate to `/admin/review`
- Verify session appears in queue with confidence score + weak component

**5. Call mode (@Umang)**
- Start session with `interview_mode: "call"`
- Verify rubric weights rebalanced (no stitch_quality)
- Verify phase 3 uses verbal walkthrough not photo upload

**6. Photo cross-questioning (@Umang)**
- Upload any work photo to `/api/assessment/analyze-photo`
- Verify 4 Hindi questions generated about visible details
- Answer each; verify confidence score computed

**7. Full demo flow**
- Ramu persona (12 years, tailor, no camera)
- Complete all 5 phases
- Check: passport generated, karma computed, PassportCard renders with tier badge
- Compare with 2-year worker passport side-by-side

---

## 10. CURRENT CODEBASE — KEY FILES

| File | What it does | Who should read it |
|---|---|---|
| `backend/app/agents/screening_logic.py` | Core scoring, RUBRIC_WEIGHTS, finalize_session | @Lakshya @Lassi |
| `backend/app/agents/interview.py` | Phase definitions, stage transitions | @Umang @Lassi |
| `backend/app/models.py` | All Pydantic models (Session, Worker, IntegrityLog) | All |
| `backend/app/services/store.py` | In-memory dicts | @Lassi (Cosmos migration) |
| `backend/app/api/routes/sessions.py` | Session lifecycle endpoints | @Umang (call mode, vision) |
| `frontend/src/pages/ScreeningRoomPage.jsx` | Worker interview UI, MediaPipe, WAV encoder | @Srija @Umang |
| `frontend/src/pages/AdminDashboardPage.jsx` | Admin/recruiter reporting, override UI | @Srija @Lassi |
| `frontend/src/i18n/language.jsx` | en/hi locale context | @Srija @Bipasha |
| `frontend/src/services/api.js` | All axios API calls | All |
| `backend/app/agents/interview-system.md` | GPT system prompt for screening agent | @Lassi @Umang |

---

*Blueprint v3 — Team BitNova — March 2026*
