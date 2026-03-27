import json
import re
from pathlib import Path

from openai import AzureOpenAI

from app.config import settings
from app.models import Session, SnapshotFeedback, utc_now_iso

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "interview-system.md"
_SYSTEM_PROMPT_BY_DOMAIN = {
    "garment_worker": _SYSTEM_PROMPT_PATH,
    "beauty_professional": Path(__file__).parent / "interview-system-beauty.md",
    "carpenter": Path(__file__).parent / "interview-system-carpenter.md",
    "electrician": Path(__file__).parent / "interview-system-electrician.md",
    "general_labor": Path(__file__).parent / "interview-system-generic.md",
    "domain_unknown": Path(__file__).parent / "interview-system-generic.md",
}

DOMAIN_CONFIGS = {
    "garment_worker": {
        "label": "garment worker",
        "rubric_weights": {
            "stitch_quality": 0.32,
            "machine_familiarity": 0.26,
            "technical_knowledge": 0.22,
            "fabric_material_knowledge": 0.14,
            "communication_confidence": 0.06,
        },
        "vision_rubric": "stitch_quality",
        "vision_prompt": (
            "You are evaluating a garment worker's stitching task photo. "
            "Score the visible stitch/hem quality 0-100 (be strict: "
            "poor finishing = below 50, neat and consistent = 70-85, excellent = 85+)."
        ),
        "vision_focus": ["seam straightness", "edge finishing"],
        "fallback_summaries": {
            "pass": "Worker shows strong tailoring fundamentals and can be considered for supervised line work.",
            "hold": "Worker shows promise but needs closer supervision before deployment.",
            "reject": "Worker did not demonstrate sufficient technical knowledge for this role.",
        },
    },
    "beauty_professional": {
        "label": "beauty professional",
        "rubric_weights": {
            "work_output_quality": 0.32,
            "technique_process_knowledge": 0.26,
            "tool_product_knowledge": 0.22,
            "client_assessment": 0.14,
            "communication_confidence": 0.06,
        },
        "vision_rubric": "work_output_quality",
        "vision_prompt": (
            "You are evaluating a beauty professional's work output photo (hair/mehendi/nail). "
            "Score overall work output quality 0-100. Focus on symmetry, line consistency, "
            "edge precision, and surface finish where applicable."
        ),
        "vision_focus": ["symmetry", "line consistency", "surface finish"],
        "fallback_summaries": {
            "pass": "Worker demonstrates strong beauty service fundamentals and client-ready output quality.",
            "hold": "Worker shows potential but needs closer supervision or practice before client deployment.",
            "reject": "Worker did not demonstrate sufficient technical readiness for client-facing work.",
        },
    },
    "carpenter": {
        "label": "carpenter",
        "rubric_weights": {
            "joint_assembly_quality": 0.32,
            "tool_handling": 0.26,
            "material_knowledge": 0.22,
            "measurement_precision": 0.14,
            "communication_confidence": 0.06,
        },
        "vision_rubric": "joint_assembly_quality",
        "vision_prompt": (
            "You are evaluating a carpenter's joint/assembly task photo. "
            "Score joint/assembly quality 0-100. Focus on gap tightness, surface flushness, "
            "grain alignment, adhesive/fastener evidence, and squareness."
        ),
        "vision_focus": ["gap tightness", "surface flushness", "grain alignment"],
        "fallback_summaries": {
            "pass": "Worker shows solid carpentry fundamentals and acceptable joint quality.",
            "hold": "Worker shows promise but needs closer supervision before independent deployment.",
            "reject": "Worker did not demonstrate sufficient carpentry fundamentals for this role.",
        },
    },
    "electrician": {
        "label": "electrician",
        "rubric_weights": {
            "safety_protocol": 0.30,
            "circuit_load_knowledge": 0.26,
            "circuit_diagram_quality": 0.22,
            "tool_instrument_knowledge": 0.16,
            "communication_confidence": 0.06,
        },
        "vision_rubric": "circuit_diagram_quality",
        "vision_prompt": (
            "You are evaluating an electrician's circuit diagram photo. "
            "Score diagram quality 0-100. Focus on symbol correctness, L/N/E labeling, "
            "circuit logic layout, notation clarity, and completeness."
        ),
        "vision_focus": ["symbol correctness", "L/N/E labeling", "circuit logic"],
        "fallback_summaries": {
            "pass": "Worker shows solid safety and circuit fundamentals suitable for supervised site work.",
            "hold": "Worker shows potential but needs closer verification on safety and circuit knowledge.",
            "reject": "Worker did not demonstrate sufficient safety or circuit knowledge for this role.",
        },
    },
    "general_labor": {
        "label": "general labor worker",
        "rubric_weights": {
            "attitude_motivation": 0.30,
            "reliability_punctuality": 0.25,
            "learnability_openness": 0.22,
            "physical_readiness": 0.15,
            "availability_flexibility": 0.08,
        },
        "vision_rubric": None,
        "vision_prompt": "No vision task required.",
        "vision_focus": ["not_applicable"],
        "fallback_summaries": {
            "pass": "Worker is behaviorally ready for helper/trainee style placements.",
            "hold": "Worker is promising but needs supervised placement and recruiter review.",
            "reject": "Worker needs additional support before placement.",
        },
    },
    "domain_unknown": {
        "label": "general labor worker",
        "rubric_weights": {
            "attitude_motivation": 0.30,
            "reliability_punctuality": 0.25,
            "learnability_openness": 0.22,
            "physical_readiness": 0.15,
            "availability_flexibility": 0.08,
        },
        "vision_rubric": None,
        "vision_prompt": "No vision task required.",
        "vision_focus": ["not_applicable"],
        "fallback_summaries": {
            "pass": "Worker is behaviorally ready for helper/trainee style placements.",
            "hold": "Worker is promising but needs supervised placement and recruiter review.",
            "reject": "Worker needs additional support before placement.",
        },
    },
}

DOMAIN_KEYWORDS = {
    "electrician": ["electrician", "electric", "wiring", "bijli", "circuit", "switch", "panel", "mcb", "rccb", "rcbo"],
    "beauty_professional": ["beauty", "hair", "mehendi", "henna", "nail", "salon", "makeup"],
    "carpenter": ["carpenter", "wood", "furniture", "joinery", "door", "window", "saw", "chisel"],
    "garment_worker": ["garment", "tailor", "tailoring", "stitch", "sew", "silai", "kurta", "blouse", "shirt", "pant", "seam"],
}


def _is_labor_domain(domain: str | None) -> bool:
    return (domain or "") in {"general_labor", "domain_unknown"}


def detect_domain(*texts: str) -> str:
    corpus = " ".join(t for t in texts if t).lower()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if any(k in corpus for k in keywords):
            return domain
    return "general_labor"


def classify_trade_with_confidence(*texts: str) -> tuple[str, float, str]:
    corpus = " | ".join(t for t in texts if t).strip()
    if not corpus:
        return "general_labor", 0.0, "empty_input"

    self_declared_unskilled_signals = [
        "koi kaam nahi aata",
        "no skill",
        "kuch bhi karne ko taiyar",
        "first job",
        "fresher",
        "helper ka kaam",
        "loading",
        "unloading",
        "safai",
        "construction helper",
        "mazdoor",
        "0 years",
        "zero years",
    ]
    lowered = corpus.lower()
    if any(sig in lowered for sig in self_declared_unskilled_signals):
        return "general_labor", 0.95, "self_declared_unskilled"

    # Fast keyword fallback baseline.
    keyword_domain = detect_domain(corpus)
    keyword_conf = 0.8 if keyword_domain != "general_labor" else 0.45

    try:
        client = _get_openai_client()
        resp = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                    "Classify worker trade into one of: garment_worker, beauty_professional, carpenter, electrician, general_labor. "
                        "Return ONLY JSON: {\"domain\": string, \"confidence\": number}. "
                        "confidence must be between 0 and 1."
                    ),
                },
                {"role": "user", "content": corpus},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=80,
        )
        data = json.loads(resp.choices[0].message.content)
        llm_domain = str(data.get("domain", "general_labor")).strip().lower()
        if llm_domain not in DOMAIN_CONFIGS:
            llm_domain = "general_labor"
        try:
            llm_conf = float(data.get("confidence", 0.0))
        except (TypeError, ValueError):
            llm_conf = 0.0
        llm_conf = max(0.0, min(1.0, llm_conf))

        if llm_conf >= 0.70:
            return llm_domain, llm_conf, "llm_confident"
        if keyword_domain != "general_labor":
            return keyword_domain, max(keyword_conf, llm_conf), "keyword_fallback_low_llm_conf"
        return "general_labor", llm_conf, "llm_low_confidence"
    except Exception:
        return keyword_domain, keyword_conf, "keyword_only"


def get_domain_config(domain: str | None) -> dict:
    key = domain if domain in DOMAIN_CONFIGS else "garment_worker"
    return DOMAIN_CONFIGS[key]


def build_default_self_ratings(domain: str | None) -> dict[str, float]:
    config = get_domain_config(domain)
    # Silent bootstrap until explicit Phase 1B capture UI is added.
    return {k: 3.0 for k in config["rubric_weights"].keys()}


def _get_openai_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )


def choose_opening_question(worker_name: str, assignment: str, locale: str = "en", domain: str | None = None) -> str:
    config = get_domain_config(domain)
    domain_label = config["label"]
    if _is_labor_domain(domain):
        if locale == "hi":
            return (
                "नमस्ते! श्रमिक.ai स्क्रीनिंग में आपका स्वागत है। "
                "पहले बताइए — आपका पूरा नाम क्या है, "
                "आप किस तरह का काम करते हैं, "
                "और आपको कितने सालों का अनुभव है?"
            )
        return (
            "Hello! Welcome to Shramik.ai screening. "
            "To start, please tell us — your full name, "
            "what kind of work you do, "
            "and how many years of experience you have."
        )
    if locale == "hi":
        return (
            f"नमस्ते! श्रमिक.ai स्क्रीनिंग में आपका स्वागत है। "
            f"पहले बताइए — आपका पूरा नाम क्या है, "
            f"आप {domain_label} का काम करते हैं — इसकी पुष्टि करें, "
            f"और कितने सालों से यह काम कर रहे हैं?"
        )
    return (
        f"Hello! Welcome to Shramik.ai screening. "
        f"To start, please tell us — your full name, "
        f"confirm that you work in {domain_label}, "
        f"and how many years of experience you have."
    )


_HINDI_DIRECTIVE = (
    "\n\n## LANGUAGE OVERRIDE — STRICT\n"
    "The user has selected Hindi. You MUST reply ONLY in Hindi using Devanagari script. "
    "Do NOT use Roman/English script for any Hindi word. English technical terms (machine, stitch, seam, etc.) "
    "may be kept in English when there is no common Hindi equivalent, but all sentence structure, "
    "grammar, and explanations must be in Devanagari Hindi."
)

_ENGLISH_DIRECTIVE = (
    "\n\n## LANGUAGE OVERRIDE — STRICT\n"
    "The user has selected English. You MUST reply ONLY in English. "
    "Do not mix in Hindi or Hinglish."
)

PHASE0_FIELDS = ["name", "age", "sex", "address", "tradeRaw", "yearsExp"]


def init_phase0_profile(worker_name: str, trade_raw: str) -> dict:
    return {
        "name": worker_name.strip() if worker_name else "",
        "age": None,
        "sex": None,
        "address": None,
        "tradeRaw": trade_raw.strip() if trade_raw else "",
        "yearsExp": None,
    }


def _field_missing(profile: dict, field: str) -> bool:
    value = profile.get(field)
    if field in {"age", "yearsExp"}:
        return value is None
    return not bool(str(value).strip()) if value is not None else True


def phase0_missing_fields(profile: dict) -> list[str]:
    return [f for f in PHASE0_FIELDS if _field_missing(profile, f)]


def _phase0_question(field: str, locale: str, domain: str | None = None) -> str:
    is_labor = _is_labor_domain(domain)
    hi = {
        "name": "Aapka poora naam kya hai?",
        "age": "Aapki umar kitni hai?",
        "sex": "Aap kaunsa gender identify karte hain?",
        "address": "Aap kahan rehte hain? Sheher aur state batayein.",
        "tradeRaw": "Aap kya kaam karte hain? Apne kaam ke baare mein batayein.",
        "yearsExp": (
            "Aapne pehle kis-kis type ka kaam kiya hai? "
            "Agar experience nahi hai toh bataiye aap kaunsa kaam kar sakte hain."
            if is_labor else
            "Yeh kaam kitne saalon se kar rahe hain?"
        ),
    }
    en = {
        "name": "What is your full name?",
        "age": "How old are you?",
        "sex": "What gender do you identify as?",
        "address": "Where do you live? Please share city and state.",
        "tradeRaw": "What kind of work do you do? Please describe your trade.",
        "yearsExp": (
            "What kind of work have you done before? "
            "If you do not have experience yet, what work can you do?"
            if is_labor else
            "How many years of experience do you have in this work?"
        ),
    }
    return (hi if locale == "hi" else en)[field]


def _extract_phase0_fields(worker_text: str) -> dict:
    text = worker_text.strip()
    lowered = text.lower()
    extracted: dict = {}
    nums = re.findall(r"\b\d{1,2}\b", lowered)
    if nums:
        n = int(nums[0])
        if 14 <= n <= 80:
            extracted["age"] = n
        if 0 <= n <= 50:
            extracted["yearsExp"] = n
    if any(k in lowered for k in ["male", "m", "man", "ladka", "पुरुष", "आदमी"]):
        extracted["sex"] = "male"
    elif any(k in lowered for k in ["female", "f", "woman", "ladki", "महिला", "औरत"]):
        extracted["sex"] = "female"
    elif any(k in lowered for k in ["other", "trans", "non-binary", "अन्य"]):
        extracted["sex"] = "other"
    if any(k in lowered for k in ["tailor", "silai", "stitch", "garment", "carpenter", "wood", "electric", "bijli", "beauty", "hair", "mehendi", "nail"]):
        extracted["tradeRaw"] = text
    if "," in text or "city" in lowered or "state" in lowered or "gaon" in lowered or "nagar" in lowered:
        extracted["address"] = text
    return extracted


def process_phase0_turn(session: Session, worker_text: str, locale: str = "en") -> dict:
    profile = dict(session.phase0_profile or {})
    if not profile:
        profile = init_phase0_profile(session.worker_name, session.assignment)

    extracted = _extract_phase0_fields(worker_text)
    for key, value in extracted.items():
        if value is None:
            continue
        profile[key] = value

    # LLM fallback to fill fields from natural language when regex is weak.
    try:
        client = _get_openai_client()
        resp = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract intake fields from one worker utterance. "
                        "Return ONLY JSON with keys: name, age, sex, address, tradeRaw, yearsExp. "
                        "Use null when unavailable."
                    ),
                },
                {"role": "user", "content": worker_text},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=120,
        )
        data = json.loads(resp.choices[0].message.content)
        if data.get("name") and _field_missing(profile, "name"):
            profile["name"] = str(data["name"]).strip()
        if data.get("address") and _field_missing(profile, "address"):
            profile["address"] = str(data["address"]).strip()
        if data.get("tradeRaw") and _field_missing(profile, "tradeRaw"):
            profile["tradeRaw"] = str(data["tradeRaw"]).strip()
        if data.get("sex") and _field_missing(profile, "sex"):
            profile["sex"] = str(data["sex"]).strip().lower()
        try:
            age_val = data.get("age")
            if age_val is not None and _field_missing(profile, "age"):
                profile["age"] = max(14, min(80, int(age_val)))
        except (TypeError, ValueError):
            pass
        try:
            exp_val = data.get("yearsExp")
            if exp_val is not None and _field_missing(profile, "yearsExp"):
                profile["yearsExp"] = max(0, min(50, int(exp_val)))
        except (TypeError, ValueError):
            pass
    except Exception:
        pass

    missing = phase0_missing_fields(profile)
    if missing:
        return {
            "phase0_profile": profile,
            "phase0_completed": False,
            "ai_reply": _phase0_question(missing[0], locale, session.domain),
            "phase": "intro",
            "rubric_tag": None,
            "score_delta": 0.0,
        }

    transition_hi = "Dhanyawad. Intake complete ho gaya hai. Ab hum technical assessment shuru karte hain."
    transition_en = "Thanks. Intake is complete. We will now begin the technical assessment."
    return {
        "phase0_profile": profile,
        "phase0_completed": True,
        "ai_reply": transition_hi if locale == "hi" else transition_en,
        "phase": "technical",
        "rubric_tag": None,
        "score_delta": 0.0,
    }


def run_agent_turn(session: Session, worker_text: str, locale: str = "en") -> dict:
    """Call GPT-4o with full conversation history.
    Returns ai_reply, rubric_tag, phase, score_delta."""
    prompt_path = _SYSTEM_PROMPT_BY_DOMAIN.get(session.domain, _SYSTEM_PROMPT_PATH)
    system_prompt = prompt_path.read_text(encoding="utf-8")
    system_prompt += _HINDI_DIRECTIVE if locale == "hi" else _ENGLISH_DIRECTIVE
    if session.grounded_questions:
        questions = "\n".join(f"{i+1}. {q}" for i, q in enumerate(session.grounded_questions))
        system_prompt += (
            "\n\n## GROUNDED QUESTIONS (PHASE 2 PRIORITY)\n"
            "Ask these grounded, prior-work questions at the start of the technical phase before the standard bank. "
            "Do not skip them unless the worker has already answered them in their explanation.\n"
            f"{questions}"
        )

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for item in session.transcript:
        role = "assistant" if item.speaker == "ai" else "user"
        messages.append({"role": role, "content": item.text})
    messages.append({"role": "user", "content": worker_text})

    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    raw = resp.choices[0].message.content
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {}

    try:
        score_delta = float(result.get("score_delta", 0))
        score_delta = max(-8.0, min(8.0, score_delta))
    except (TypeError, ValueError):
        score_delta = 0.0

    fallback = "समझ नहीं आया, कृपया दोबारा बोलें।" if locale == "hi" else "I didn't understand, please say that again."
    return {
        "ai_reply": result.get("reply", fallback),
        "rubric_tag": result.get("rubric_tag"),
        "phase": result.get("phase", session.current_phase),
        "score_delta": score_delta,
    }


def build_snapshot_feedback(
    note: str,
    current_score: float,
    image_data: str = "",
    domain: str | None = None,
) -> SnapshotFeedback:
    """Analyze snapshot image with GPT-4o vision. Falls back to formula if no image."""
    config = get_domain_config(domain)
    if image_data:
        try:
            client = _get_openai_client()
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data, "detail": "low"},
                        },
                        {
                            "type": "text",
                            "text": (
                                f"{config['vision_prompt']} "
                                f"Context note from supervisor: '{note}'. "
                                "Return ONLY JSON: {\"quality_score\": int, "
                                "\"feedback\": \"1 sentence\", "
                                "\"focus_areas\": [\"area1\", \"area2\"], "
                                "\"vision_confidence\": number}"
                            ),
                        },
                    ],
                }],
                response_format={"type": "json_object"},
                max_tokens=200,
            )
            data = json.loads(resp.choices[0].message.content)
            quality_score = float(max(0, min(100, int(data.get("quality_score", 60)))))
            feedback = str(data.get("feedback", ""))
            focus_areas = data.get("focus_areas", config["vision_focus"])
            if not isinstance(focus_areas, list) or not focus_areas:
                focus_areas = config["vision_focus"]
            try:
                vision_confidence = float(data.get("vision_confidence", 0.7))
            except (TypeError, ValueError):
                vision_confidence = 0.7
            return SnapshotFeedback(
                captured_at=utc_now_iso(),
                quality_score=quality_score,
                feedback=feedback,
                focus_areas=focus_areas[:3],
                note=note,
                vision_confidence=vision_confidence,
            )
        except Exception:
            pass  # fall through to formula fallback

    # Formula fallback (no image or vision call failed)
    quality_score = round(min(85.0, max(30.0, current_score + 5.0)), 2)
    focus_areas = config["vision_focus"]
    if config["label"] == "garment worker" and ("collar" in note.lower() or "curve" in note.lower()):
        focus_areas = ["curve control", "seam consistency"]
    return SnapshotFeedback(
        captured_at=utc_now_iso(),
        quality_score=quality_score,
        feedback="Image not available for analysis. Score estimated from session progress.",
        focus_areas=focus_areas,
        note=note,
    )


def _evaluate_transcript(session: Session, locale: str = "en") -> dict:
    """GPT-4o evaluates the full transcript and returns per-rubric scores 0-100."""
    transcript_text = "\n".join(
        f"{'AI' if t.speaker == 'ai' else 'Worker'}: {t.text}"
        for t in session.transcript
        if t.speaker in ("ai", "worker")
    )

    if not transcript_text.strip():
        return {}

    lang_note = (
        " Write the 'summary' field in Hindi (Devanagari script only, no Roman/English words for Hindi content)."
        if locale == "hi" else
        " Write the 'summary' field in English."
    )
    config = get_domain_config(session.domain)
    rubric_keys = list(config["rubric_weights"].keys())
    rubric_key_json = ", ".join(f"\"{k}\": int" for k in rubric_keys)
    if _is_labor_domain(session.domain):
        system = (
            "You are a behavioral assessment evaluator for general labor candidates. "
            "Score each behavioral dimension from 1 to 5 (integers only). "
            "Return ONLY JSON with these exact keys: "
            "{"
            f"{rubric_key_json}, "
            "\"summary\": \"2-3 sentence recruiter summary\", "
            "\"recommendation\": \"pass|hold|reject\""
            "}" + lang_note
        )
    else:
        system = (
            f"You are Shramik.ai evaluator for {config['label']} skill screening. "
            "Analyze the full interview transcript and score the worker strictly on each rubric 0-100. "
            "Scoring guide: below 40 = poor/no knowledge, 40-60 = basic, 61-75 = competent, 76-90 = strong, 91+ = expert. "
            "A worker giving vague or one-word answers should score 20-40, not 60+. "
            "Return ONLY JSON with these exact keys: "
            "{"
            f"{rubric_key_json}, "
            "\"summary\": \"2 honest sentences about this worker's readiness\", "
            "\"recommendation\": \"pass|hold|reject\""
            "}" + lang_note
        )

    prompt = (
        f"Worker: {session.worker_name}\n"
        f"Assignment: {session.assignment}\n\n"
        f"Full transcript:\n{transcript_text}\n\n"
        "Evaluate strictly. Do not inflate scores."
    )

    client = _get_openai_client()
    resp = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    try:
        return json.loads(resp.choices[0].message.content)
    except (json.JSONDecodeError, AttributeError):
        return {}


def build_prior_work_media(
    images: list[str],
    note: str,
    domain: str | None,
) -> tuple[list[dict], list[str]]:
    config = get_domain_config(domain)
    client = _get_openai_client()
    media_items: list[dict] = []
    summaries: list[str] = []

    for image in images:
        try:
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image, "detail": "low"}},
                        {"type": "text", "text": (
                            f"You are reviewing prior-work media for a {config['label']}. "
                            "Describe what is visible in concrete terms and judge if it is relevant to the trade. "
                            "Return ONLY JSON: {\"summary\": \"1-2 sentences\", "
                            "\"relevance\": \"relevant|unclear|irrelevant\", "
                            "\"vision_confidence\": number}"
                        )},
                    ],
                }],
                response_format={"type": "json_object"},
                max_tokens=200,
            )
            data = json.loads(resp.choices[0].message.content)
            summary = str(data.get("summary", "")).strip() or "Work sample observed."
            relevance = str(data.get("relevance", "unclear")).lower()
            if relevance not in {"relevant", "unclear", "irrelevant"}:
                relevance = "unclear"
            try:
                vision_confidence = float(data.get("vision_confidence", 0.7))
            except (TypeError, ValueError):
                vision_confidence = 0.7
        except Exception:
            summary = "Work sample observed."
            relevance = "unclear"
            vision_confidence = 0.6

        media_items.append({
            "summary": summary,
            "relevance": relevance,
            "vision_confidence": vision_confidence,
        })
        summaries.append(summary)

    grounded_questions: list[str] = []
    if summaries:
        try:
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[
                    {"role": "system", "content": (
                        "You are generating 2-3 grounded, problem-solving questions "
                        "about the worker's prior work samples. "
                        "Questions should test ownership of the work, not general theory. "
                        "Return ONLY JSON: {\"grounded_questions\": [\"q1\", \"q2\", \"q3\"]}"
                    )},
                    {"role": "user", "content": (
                        f"Worker trade: {config['label']}\n"
                        f"Worker note: {note}\n"
                        f"Observed summaries:\n- " + "\n- ".join(summaries)
                    )},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=200,
            )
            data = json.loads(resp.choices[0].message.content)
            grounded_questions = [q for q in data.get("grounded_questions", []) if isinstance(q, str) and q.strip()]
        except Exception:
            grounded_questions = []

    return media_items, grounded_questions[:3]


def build_portfolio_enrichment(images: list[str], note: str, domain: str | None) -> list[dict]:
    config = get_domain_config(domain)
    client = _get_openai_client()
    items: list[dict] = []
    for image in images:
        try:
            resp = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image, "detail": "low"}},
                        {"type": "text", "text": (
                            f"Tag complexity for this {config['label']} portfolio sample. "
                            "Return ONLY JSON: {\"summary\": \"1 sentence\", "
                            "\"complexity\": \"entry|standard|skilled|complex\"}"
                        )},
                    ],
                }],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=120,
            )
            data = json.loads(resp.choices[0].message.content)
            summary = str(data.get("summary", "")).strip() or "Portfolio sample captured."
            complexity = str(data.get("complexity", "standard")).strip().lower()
            if complexity not in {"entry", "standard", "skilled", "complex"}:
                complexity = "standard"
        except Exception:
            summary = "Portfolio sample captured."
            complexity = "standard"
        items.append({"summary": summary, "complexity": complexity, "note": note})
    return items


def _blend_voice_vision(voice_score: float, vision_score: float, vision_confidence: float | None) -> float:
    if vision_confidence is not None and vision_confidence <= 0.65:
        return round(voice_score, 2)
    blended = (vision_score * 0.75) + (voice_score * 0.25)
    delta = max(-2.0, min(2.0, blended - voice_score))
    return round(max(0.0, min(100.0, voice_score + delta)), 2)


def _score_to_band_1_to_5(score_0_100: float) -> int:
    score_0_10 = score_0_100 / 10.0
    if score_0_10 >= 8.5:
        return 5
    if score_0_10 >= 7.0:
        return 4
    if score_0_10 >= 5.5:
        return 3
    if score_0_10 >= 3.0:
        return 2
    return 1


def _build_self_awareness_profile(session: Session, rubric_raw: dict[str, float]) -> dict:
    if not session.self_ratings:
        return {"score": 0.0, "label": "Unavailable", "breakdown": {}}
    breakdown: dict[str, dict] = {}
    deltas: list[float] = []
    for key, self_rating in session.self_ratings.items():
        assessed_band = _score_to_band_1_to_5(rubric_raw.get(key, session.live_score))
        delta = abs(float(self_rating) - assessed_band)
        deltas.append(delta)
        if delta == 0:
            label = "Well Calibrated"
        elif delta == 1:
            label = "Slight Estimate"
        elif assessed_band < self_rating:
            label = "Overestimates Own Skill"
        else:
            label = "Underestimates Own Skill"
        breakdown[key] = {
            "self_rating": float(self_rating),
            "assessed_band": assessed_band,
            "delta": delta,
            "calibration": label,
        }
    avg_delta = sum(deltas) / max(1, len(deltas))
    score = round(max(0.0, 5.0 - avg_delta), 2)
    overall = "Well Calibrated" if avg_delta <= 0.5 else "Slight Estimate" if avg_delta <= 1.0 else "Needs Recruiter Probe"
    return {"score": score, "label": overall, "breakdown": breakdown}


def _build_assessment_confidence(session: Session, rubric_raw: dict[str, float], self_awareness_profile: dict) -> dict:
    if _is_labor_domain(session.domain):
        worker_turns = [t for t in session.transcript if t.speaker == "worker"]
        transcript_depth = min(1.0, len(worker_turns) / 10.0)
        acoustic_vals = [float(t.acoustic_confidence) for t in worker_turns if t.acoustic_confidence is not None]
        acoustic_avg = sum(acoustic_vals) / len(acoustic_vals) if acoustic_vals else 0.65
        acoustic_avg = max(0.0, min(1.0, acoustic_avg))
        answer_consistency = 0.85
        total = round((transcript_depth * 0.50) + (acoustic_avg * 0.30) + (answer_consistency * 0.20), 2)
        band = "Reliable" if total >= 0.70 else "Medium" if total >= 0.45 else "Low"
        return {
            "transcriptDepth": round(transcript_depth, 2),
            "acousticConsistency": round(acoustic_avg, 2),
            "answerConsistency": round(answer_consistency, 2),
            "overallConfidence": total,
            "band": band,
            "manualReviewRecommended": total < 0.45,
        }
    rubric_keys = list(get_domain_config(session.domain)["rubric_weights"].keys())
    worker_turns = [t for t in session.transcript if t.speaker == "worker"]
    transcript_depth = min(1.0, len(worker_turns) / max(6, len(rubric_keys) * 2))

    evidence_quality = 0.9
    if not session.prior_work_media:
        evidence_quality -= 0.10
    if not session.snapshot_feedback:
        evidence_quality -= 0.15
    else:
        last_conf = session.snapshot_feedback[-1].vision_confidence
        if last_conf is not None and last_conf <= 0.65:
            evidence_quality -= 0.10
    evidence_quality = max(0.0, min(1.0, evidence_quality))

    acoustic_vals = [float(t.acoustic_confidence) for t in worker_turns if t.acoustic_confidence is not None]
    acoustic_avg = sum(acoustic_vals) / len(acoustic_vals) if acoustic_vals else 0.6
    acoustic_avg = max(0.0, min(1.0, acoustic_avg))

    answer_consistency = 0.9

    sa_score = float(self_awareness_profile.get("score", 0.0))
    self_awareness_alignment = max(0.0, min(1.0, sa_score / 5.0))

    integrity = max(0.0, min(1.0, float(session.integrity_log.integrity_score)))

    total = (
        transcript_depth * 0.25 +
        evidence_quality * 0.20 +
        acoustic_avg * 0.20 +
        answer_consistency * 0.20 +
        self_awareness_alignment * 0.10 +
        integrity * 0.05
    )
    total = round(max(0.0, min(1.0, total)), 2)
    band = "High" if total >= 0.75 else "Medium" if total >= 0.55 else "Low" if total >= 0.35 else "Unreliable"
    return {
        "score": total,
        "band": band,
        "humanReviewRecommended": total < 0.75,
        "components": {
            "transcript_depth": round(transcript_depth, 2),
            "evidence_quality": round(evidence_quality, 2),
            "acoustic_confidence_avg": round(acoustic_avg, 2),
            "answer_consistency": round(answer_consistency, 2),
            "self_awareness_alignment": round(self_awareness_alignment, 2),
            "integrity": round(integrity, 2),
        },
    }


def finalize_session(session: Session, locale: str = "en") -> Session:
    # GPT-4o evaluates the actual transcript content
    eval_result = _evaluate_transcript(session, locale)

    config = get_domain_config(session.domain)
    rubric_keys = list(config["rubric_weights"].keys())
    fallback_score = round(max(0.0, min(100.0, session.live_score)), 2)

    rubric_raw: dict[str, float] = {}
    for key in rubric_keys:
        try:
            raw_val = float(eval_result.get(key, fallback_score))
            if _is_labor_domain(session.domain):
                rubric_raw[key] = max(1.0, min(5.0, round(raw_val, 2)))
            else:
                rubric_raw[key] = float(max(0, min(100, int(raw_val))))
        except (TypeError, ValueError):
            rubric_raw[key] = 3.0 if _is_labor_domain(session.domain) else fallback_score

    # Apply vision blend for VLM-primary rubric when snapshot exists
    vision_key = config.get("vision_rubric")
    if vision_key and vision_key in rubric_raw and session.snapshot_feedback:
        snapshot = session.snapshot_feedback[-1]
        vision_score = snapshot.quality_score
        rubric_raw[vision_key] = _blend_voice_vision(
            rubric_raw[vision_key],
            vision_score,
            snapshot.vision_confidence,
        )

    integrity_compliance = round(session.integrity_log.integrity_score * 100, 2)

    if _is_labor_domain(session.domain):
        placement_readiness = round(sum(rubric_raw[k] * w for k, w in config["rubric_weights"].items()) * 2.0, 2)
        overall = placement_readiness
    else:
        overall = round(
            sum(rubric_raw[k] * w for k, w in config["rubric_weights"].items()),
            2,
        )
        # Blend with integrity
        overall = round(overall * 0.94 + integrity_compliance * 0.06, 2)

    rubric_scores = {**rubric_raw}
    if not _is_labor_domain(session.domain):
        rubric_scores["integrity_compliance"] = integrity_compliance
    self_awareness_profile = _build_self_awareness_profile(session, rubric_raw)
    assessment_confidence = _build_assessment_confidence(session, rubric_raw, self_awareness_profile)
    labor_pool_profile = {}
    if _is_labor_domain(session.domain):
        label = "Ready" if overall >= 8.0 else "Promising" if overall >= 6.0 else "Developing" if overall >= 4.0 else "Needs Support"
        profile = session.phase0_profile or {}
        labor_pool_profile = {
            "profileType": "labor_pool_profile",
            "pathTrigger": session.domain_detection_method,
            "identity": {
                "name": profile.get("name") or session.worker_name,
                "age": profile.get("age"),
                "sex": profile.get("sex"),
                "address": profile.get("address"),
            },
            "behavioralScores": rubric_raw,
            "placementReadiness": {"score": overall, "label": label},
            "recruiterSummary": str(eval_result.get("summary", "")) or "Behavioral profile generated for labor-pool placement.",
            "assessmentConfidence": assessment_confidence,
        }

    if session.integrity_log.overall_flag == "critical_flag":
        recommendation = "reject"
        summary = (
            "इंटरव्यू के दौरान चेहरा बदल गया। आगे बढ़ने से पहले भर्तीकर्ता सत्यापन आवश्यक है।"
            if locale == "hi" else
            "Face identity changed during interview. Recruiter verification required before proceeding."
        )
    else:
        llm_rec = str(eval_result.get("recommendation", "")).lower().strip()
        recommendation = llm_rec if llm_rec in {"pass", "hold", "reject"} else (
            "pass" if overall >= 75 else "hold" if overall >= 50 else "reject"
        )
        if locale == "hi":
            fallback_summaries = {
                "pass": "श्रमिक ने मज़बूत कौशल दिखाया और पर्यवेक्षित कार्य के लिए उपयुक्त है।",
                "hold": "श्रमिक में संभावना है, लेकिन तैनाती से पहले करीबी पर्यवेक्षण की ज़रूरत है।",
                "reject": "श्रमिक ने इस भूमिका के लिए पर्याप्त तकनीकी ज्ञान नहीं दिखाया।",
            }
        else:
            fallback_summaries = config["fallback_summaries"]
        summary = str(eval_result.get("summary", "")) or fallback_summaries[recommendation]

    return session.model_copy(
        update={
            "status": "completed",
            "ended_at": utc_now_iso(),
            "live_score": overall,
            "recommendation": recommendation,
            "summary": summary,
            "rubric_scores": rubric_scores,
            "self_awareness_profile": self_awareness_profile,
            "assessment_confidence": assessment_confidence,
            "labor_pool_profile": labor_pool_profile,
        }
    )
