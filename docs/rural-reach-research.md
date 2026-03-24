# Research: Making Shramik.ai Work for Rural India

## The Problem Landscape

There are actually **three distinct user populations** here, not two:

| Population | Device | Connectivity | Current Solution | Gap |
|---|---|---|---|---|
| **Rural, basic phone** | Keypad feature phone | Voice calls only (2G/voice) | Nothing | IVR calling channel |
| **Peri-urban, entry Android** | Rs. 5,000–8,000 Android | Intermittent 2G data, WhatsApp works | Broken web app | WhatsApp channel |
| **Urban/semi-urban Android** | Decent smartphone | Patchy 4G, drops to no signal indoors | Current web app | Offline PWA fallback |

One architecture solves all three. The insight is that **you don't need three separate products** — you need one assessment engine with three front-door channels that all converge to the same scoring pipeline and recruiter dashboard.

---

## Architecture: Three Channels, One Engine

```
+------------------------------------------------------------------+
|                        CHANNEL LAYER                             |
+-------------------+----------------------+-----------------------+
|  VOICE CALL       |  WHATSAPP            |  OFFLINE PWA          |
|  (Feature phone)  |  (2G smartphone)     |  (Smartphone, no data)|
|  Exotel/ACS IVR   |  Sarvam Samvaad +    |  WebLLM + Whisper.cpp |
|                   |  WhatsApp Business   |  on-device            |
+--------+----------+----------+-----------+----------+------------+
         |                     |                       |
+--------v---------------------v-----------------------v-----------+
|              SPEECH LAYER (Sarvam AI -- already integrated)      |
|          STT: saaras:v3   <->   TTS: bulbul:v2 (anushka)        |
|     [or Whisper.cpp on-device when fully offline]                |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|                    LLM ROUTING LAYER                             |
|  Strong connectivity  ->  Azure OpenAI GPT-4o (current)         |
|  Weak connectivity    ->  Phi-4-mini-instruct (Azure AI Foundry) |
|  Zero connectivity    ->  Phi-3.5-mini ONNX (on-device)         |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|                  SCORING ENGINE (unchanged logic)                |
|  Rubric scores + Assessment Confidence Score computed            |
|  Confidence >= 0.80  ->  auto-pass to recruiter                 |
|  Confidence 0.55-0.79 -> human review queue                     |
|  Confidence < 0.55   ->  mandatory review + re-interview prompt  |
+--------------+---------------------------------------------------+
               |
+--------------v--------------+      +-----------------------------+
|   RECRUITER DASHBOARD       | <--- |   HUMAN REVIEW QUEUE        |
|   (current AdminDashboard)  |      |   (new page, next-day SLA)  |
+-----------------------------+      +-----------------------------+
```

---

## Channel 1: Voice Call (Feature Phone)

### The stack

The right choice here is **Exotel AgentStream** — not because Azure doesn't have the capability, but because Exotel is purpose-built for India.

**Why Exotel over Azure Communication Services:**
- [Exotel AgentStream](https://exotel.com/blog/voice-ai-infrastructure-exotel-agentstream/) achieves **<20ms voice streaming latency** vs. industry average of 150ms — critical for natural conversation feel over Indian PSTN
- DPDPA-ready: call metadata stays within India (legally important for worker data)
- CLI routing + STD awareness optimized specifically for Indian telecom behaviour
- Vernacular-first design with native Indic language STT/TTS partnerships
- However: if judges are Azure-focused, use **Azure Communication Services** + the [ART Voice Agent Accelerator](https://github.com/Azure-Samples/art-voice-agent-accelerator) which Microsoft open-sourced specifically for this use case — it gives you IVR, barge-in, WebSocket streaming, and ACS Call Automation in one package

**The call flow:**

```
Worker dials toll-free number
        |
IVR greeting (Sarvam TTS, Hindi)
"Shramik.ai mein aapka swagat hai. Hindi mein jaari rakhne ke liye 1 dabayein."
        |
Worker says name + candidate code (spoken, not DTMF -- they may not know codes)
        |
Session created in backend with interview_mode: "call"
        |
Phase 1 -> 2 -> 3* -> 4 over voice (*no photo task -- see below)
        |
AI response delivered via TTS; worker responds; loop continues
        |
Session completed -> confidence scored -> routed to HITL or recruiter
```

**What changes in call mode:**
- No `stitch_quality` rubric (no camera). Weights rebalanced:
  `machine_familiarity: 0.35, technical_knowledge: 0.33, fabric_material_knowledge: 0.20, communication_confidence: 0.12`
- Phase 3 becomes a **verbal walkthrough** of the task instead: "Agar aapke paas machine hoti, toh aap seam kaise banate — step by step batayein"
- MediaPipe integrity disabled; `interview_mode: "call"` badge shown in admin dashboard
- Session timeout: soft warning at 12 min, hard cutoff at 18 min
- **Barge-in supported** via ACS `interruptionThreshold` — worker doesn't have to wait for AI to finish speaking

**Latency budget (end-to-end):**

| Step | Time |
|---|---|
| Sarvam STT | 400–500ms |
| Phi-4-mini on Azure AI Foundry | 600–900ms |
| Sarvam TTS | 350–450ms |
| **Total** | **~1.4–1.9 seconds** |

Acceptable for an interview context.

---

## Channel 2: WhatsApp (2G Smartphone)

### Why WhatsApp is the best channel for this use case

WhatsApp has ~95% penetration among Indian smartphone users, works reliably on 2G, requires zero installation, and rural workers already know how to use it. Meta has explicitly positioned [WhatsApp voice notes as the primary tool for rural India](https://www.socialsamosa.com/campaign-spot/whatsapp-latest-campaign-voice-notes-connect-rural-india-10915410).

The critical discovery: **Sarvam AI already has a WhatsApp channel**. Their [Sarvam Samvaad](https://www.sarvam.ai/products/conversational-agents) product supports telephone + WhatsApp + web in a single deployment. Since Sarvam is already integrated for STT/TTS, this is the cleanest possible path.

**The WhatsApp assessment flow:**

```
Recruiter sends worker a WhatsApp link/message to start
        |
Worker sends voice note (more natural than typing for many workers)
        |
Backend receives via WhatsApp webhook -> Sarvam STT -> text
        |
LLM (Phi-4-mini or GPT-4o depending on signal) generates next question
        |
Sarvam TTS -> audio file -> sent back as voice note reply
        |
Phase 3 task: worker photographs work -> sends via WhatsApp
  (WhatsApp compresses to JPEG; GPT-4o Vision still scores it)
        |
Session completes -> recruiter sees result with WhatsApp badge
```

**What makes this powerful:**
- Asynchronous-tolerant: if worker loses signal mid-interview, WhatsApp queues messages and delivers on reconnect. The interview can resume.
- Workers who prefer text can type instead — same backend handles both
- Photo submission for task quality still works through WhatsApp compression
- The blueprint's `vision_inconclusive` fallback handles compressed images gracefully
- **No app install needed. Zero friction.**

**Provider choice:** [Gupshup](https://www.gupshup.io/) (India-focused, cheaper per message, good Hindi support) or Twilio WhatsApp API. Sarvam Samvaad may provide the whole channel out of the box.

---

## Channel 3: Offline PWA (Smartphone, No Data)

### The SLM stack — the bonus points play

The mentor specifically wants SLMs. Microsoft's Phi family is the answer, and it's perfect for a Microsoft Azure hackathon because **Phi is Microsoft's own model**.

**The Phi family hierarchy for this use case:**

| Model | Params | RAM | Tokens/sec (Galaxy S21) | Use case |
|---|---|---|---|---|
| **Phi-3.5-mini-instruct ONNX** | 3.8B | 2.7GB | 6.2 tok/s | On-device interview (offline) |
| **Phi-4-mini-instruct** | 3.8B | ~2.5GB | ~8 tok/s | Cloud fallback (weak signal) |
| **Phi-4-mini-reasoning** | 3.8B | ~2.5GB | ~6 tok/s | Final rubric scoring pass |
| GPT-4o | — | cloud | cloud | Strong signal, vision scoring |

Key data point from the [ONNX Runtime blog](https://onnxruntime.ai/blogs/accelerating-phi-3): Phi-3-mini on Android achieves **6.2 tokens/second on a Samsung Galaxy S21** with 2.7GB peak RAM. On a Rs. 8,000 Android with 3–4GB RAM, this is tight but workable. On anything with 6GB+ RAM it's comfortable.

**The full offline stack:**

```
[No internet detected]
        |
Service Worker intercepts -> offline mode activated
        |
STT: Whisper.cpp Android (whisper-tiny or whisper-base, ~75MB)
     real-time streaming, <1s latency
        |
LLM: Phi-3.5-mini ONNX via ONNX Runtime GenAI
     (downloaded + cached on first WiFi session, ~2.3GB)
        |
TTS: Android TextToSpeech API (native, zero extra size)
     OR piper-tts (lightweight, better Hindi quality, ~50MB)
        |
Answers + transcript stored in IndexedDB
        |
[Internet returns] -> sync queue uploads to backend -> GPT-4o scores
                   -> snapshot queue uploads -> vision scoring happens
                   -> result delivered to worker + recruiter
```

[Whisper.cpp on Android](https://github.com/ggml-org/whisper.cpp) for offline STT is proven — multiple production Android apps use it. The `whisper-tiny` model is 75MB and handles Hindi reasonably well (Whisper was trained on 680K hours including Indian-accented speech).

**The three-level fallback chain — the core narrative for judges:**

| Level | Trigger | Model | Notes |
|---|---|---|---|
| 1 | Online + strong signal | GPT-4o (Azure OpenAI) | Best quality, vision-capable |
| 2 | Online + weak signal | Phi-4-mini-instruct (Azure AI Foundry) | Fast, cheap, structured output |
| 3 | Offline | Phi-3.5-mini ONNX (on-device) | Zero network, privacy by design |

Same assessment. Same rubrics. Same result quality. Regardless of where the worker is.

### Important notes on SLM prompt engineering

[Research confirms](https://arxiv.org/html/2404.14219v4) Phi-3.5-mini received post-training for instruction following and structured output, but prompt sensitivity is higher than GPT-4o — even small changes in template order can affect output quality. Scoring prompts need an extra testing pass when running on the SLM. The HITL layer compensates: SLM-scored sessions are more likely to fall below the 0.80 confidence threshold and get human reviewed, which is the correct behaviour.

**Use Phi-4-mini-reasoning specifically for the final scoring pass** (not live turns). It has `<think>` chain-of-thought tags and excels at multi-step structured evaluation — exactly what rubric scoring needs. Phi-4-mini-instruct is better for live conversational turns (faster, more natural).

---

## The Centaur HITL System

### Why centaur, not full-automation

[Harvard Data Science Review research](https://hdsr.mitpress.mit.edu/pub/3rvlzjtw) on centaur models found that humans who **own the decision process** and use AI as input achieve higher accuracy than both full-automation and humans who passively follow AI recommendations. The key is that reviewers must genuinely evaluate and be able to override — not rubber-stamp.

For Shramik.ai specifically, centaur is correct because:
- A wrong hiring recommendation could cost a worker their livelihood
- The model is new and unvalidated across domains (carpenter, electrician, plumber)
- Off-channel assessments (call, WhatsApp) have less signal (no vision, different audio quality)
- Recruiters need to trust the system before they will use it at scale

### The confidence routing logic

```python
if assessment_confidence >= 0.80:     # ~60% of sessions initially
    -> auto-forward to recruiter dashboard

elif assessment_confidence >= 0.55:   # ~25% of sessions
    -> human review queue
    -> reviewer sees: transcript, scores, weakest component, AI recommendation
    -> reviewer can: approve / adjust individual rubric / flag for re-interview
    -> SLA: next business day
    -> recruiter sees result with "reviewed" badge

else:                                  # ~15% of sessions
    -> mandatory review + worker prompted to retry weakest phase
    -> recruiter sees nothing until reviewed
```

Best practice from [IBM and Galileo research on HITL systems](https://galileo.ai/blog/human-in-the-loop-agent-oversight): target **10–15% escalation rate** as sustainable for a review operation long-term.

### The "remove human later" path — gradual automation

| Timeframe | Threshold | Logic |
|---|---|---|
| Month 0–1 | 100% review | Pure data collection. Every session reviewed before recruiter sees it. |
| Month 2 | Analysis pass | Per-rubric override rate computed. Which rubrics does the human consistently correct? |
| Month 3 | >= 0.75 auto-forward | If all rubrics have < 10% historical override rate and confidence is high. |
| Month 6 | Web-channel sessions >= 0.75 auto | Call/WhatsApp sessions still reviewed (less signal). |
| Month 12 | Humans review edge cases only | Integrity events, self-awareness mismatch >= 2 bands, confidence < 0.55. |

**The critical piece:** Every human review must be **structured and logged** — capture which rubric was changed, by how much, and why. This is training data for improving LLM prompts and raising confidence thresholds over time. Build this data pipeline from day one even if unused at first.

### What the human reviewer sees (new page in AdminDashboard)

```
+----------------------------------------------------------+
|  REVIEW QUEUE -- 3 sessions pending                      |
|  SLA: Today by 5pm                                       |
+----------------------------------------------------------+
|  Rekha Devi  |  Garment  |  via WhatsApp  |  Medium      |
|  Confidence: 0.61 -- Weak component: Evidence Quality    |
|  AI rec: HOLD  |  Overall: 64/100                        |
|  [Review ->]                                             |
+----------------------------------------------------------+
```

Inside the review view:
- Full transcript with per-turn rubric tags and acoustic confidence
- Side-by-side: AI rubric scores vs. self-ratings (calibration profile)
- Weak component explanation: "Evidence Quality low — no photo uploaded (WhatsApp channel)"
- Actions: Approve scores / Edit rubric score (slider + mandatory note) / Request re-interview
- Time tracking per review (to measure reviewer burden and justify automation later)

---

## Services & Technology Choices

### Recommended stack

| Need | Service | Why |
|---|---|---|
| IVR calling | [Azure Communication Services](https://learn.microsoft.com/en-us/azure/communication-services/overview) + [ART Voice Agent Accelerator](https://github.com/Azure-Samples/art-voice-agent-accelerator) | Microsoft open-source, one-click deploy, judge-friendly |
| IVR (India backup) | [Exotel AgentStream](https://exotel.com/blog/voice-ai-infrastructure-exotel-agentstream/) | <20ms latency, DPDPA compliant, Indic language native |
| WhatsApp channel | [Sarvam Samvaad](https://www.sarvam.ai/products/conversational-agents) | Already using Sarvam; native WhatsApp + telephone + web |
| WhatsApp (backup) | Gupshup or Twilio WhatsApp API | Standard, well-documented |
| Cloud SLM (weak signal) | Phi-4-mini-instruct on Azure AI Foundry | Cheapest per-token on Azure, fast structured output |
| On-device SLM (offline) | [Phi-3.5-mini ONNX](https://huggingface.co/microsoft/Phi-3.5-mini-instruct-onnx) via ONNX Runtime GenAI | Microsoft's own model, proven on Android |
| Offline STT | [Whisper.cpp Android](https://github.com/ggml-org/whisper.cpp) | ~75MB, real-time streaming, Hindi support |
| Offline TTS | Android TextToSpeech API | Native, zero size overhead |
| Rubric scoring (offline) | Phi-4-mini-reasoning | Best structured reasoning at 3.8B params |
| Offline storage | IndexedDB + Service Worker | Standard PWA offline pattern |

### Services to avoid for this use case

- **USSD (like *99#):** Works on any keypad phone, zero data, but capped at 182 characters per screen. A 15-minute back-and-forth interview is impossible within USSD constraints.
- **WhatsApp Business Calling API:** Meta launched real-time voice calls within WhatsApp in 2024. Theoretically could replace IVR for smartphone users, but it is newer, harder to integrate, and you still need IVR for feature phones. Keep channels separate.
- **Phi-4-mini-reasoning for live interview turns:** Designed for math/reasoning chains, uses `<think>` tags that slow response time. Use Phi-4-mini-**instruct** for live turns, Phi-4-mini-**reasoning** for the final scoring pass only.
- **On-device inference on devices under 3GB RAM:** Phi-3.5-mini needs 2.7GB. Add a RAM check on launch and fall back to a cached static question bank (JSON, no AI) for very low-end devices.

---

## The Hackathon Narrative

Frame this as **"Shramik.ai Reach"** — the same skill assessment, available to every Indian worker regardless of device or connectivity.

> "A garment worker in a UP village with a Rs. 1,500 feature phone calls a number, speaks to an AI in Hindi for 12 minutes, and gets a Skill Passport. A carpenter in Rajasthan with a Rs. 6,000 Android and no data completes the assessment offline using a Microsoft Phi model running entirely on his phone. A plumber in Mumbai with WhatsApp sends voice notes back and forth with the AI. All three results go to the same recruiter dashboard. Humans review edge cases. The model gets smarter every month. That is how you certify 450 million informal workers."

This hits both judging criteria:
- **Technical depth**: SLMs on-device via ONNX Runtime, real-time voice AI over PSTN, three-channel convergence architecture, centaur HITL with calibration loop
- **Market insight**: Correct distribution channels for India's actual device landscape, DPDPA compliance, gradual automation path grounded in real operational data

---

## References

- [Azure Communication Services — AI overview](https://learn.microsoft.com/en-us/azure/communication-services/concepts/ai)
- [Azure ART Voice Agent Accelerator (GitHub)](https://github.com/Azure-Samples/art-voice-agent-accelerator)
- [Exotel AgentStream — real-time voice AI infrastructure](https://exotel.com/blog/voice-ai-infrastructure-exotel-agentstream/)
- [Sarvam Samvaad — telephone + WhatsApp + web agents](https://www.sarvam.ai/products/conversational-agents)
- [ONNX Runtime: Accelerating Phi-3 on mobile](https://onnxruntime.ai/blogs/accelerating-phi-3)
- [Phi-3.5-mini-instruct ONNX (Hugging Face)](https://huggingface.co/microsoft/Phi-3.5-mini-instruct-onnx)
- [Phi-4-mini-instruct (Hugging Face)](https://huggingface.co/microsoft/Phi-4-mini-instruct)
- [Whisper.cpp — on-device STT](https://github.com/ggml-org/whisper.cpp)
- [Effective Generative AI: The Human-Algorithm Centaur (Harvard DSR)](https://hdsr.mitpress.mit.edu/pub/3rvlzjtw)
- [Human-in-the-Loop Agent Oversight — Galileo](https://galileo.ai/blog/human-in-the-loop-agent-oversight)
- [WhatsApp voice notes for rural India — Social Samosa](https://www.socialsamosa.com/campaign-spot/whatsapp-latest-campaign-voice-notes-connect-rural-india-10915410)
- [Phi-3 Technical Report (arXiv)](https://arxiv.org/html/2404.14219v4)
- [Introducing Phi-3 — Microsoft Azure Blog](https://azure.microsoft.com/en-us/blog/introducing-phi-3-redefining-whats-possible-with-slms/)
