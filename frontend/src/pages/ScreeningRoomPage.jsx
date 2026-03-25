import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mic, ShieldAlert, ShieldCheck, Square, Settings, X, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { screeningApi } from "@/services/api";
import { useLanguage } from "@/i18n/language";
import { useRole } from "@/context/role";
import PassportCard from "@/components/PassportCard";
import { LanguageToggle } from "@/App";

/* ─── WAV encoder (SarvamAI requires wav/mp3, not webm) ─────── */
async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const numChannels = 1; // mono — reduce payload size
  const sampleRate = audioBuffer.sampleRate;
  const srcData = audioBuffer.getChannelData(0); // use first channel
  const numSamples = srcData.length;

  const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);       // PCM chunk size
  view.setUint16(20, 1, true);        // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, srcData[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

/* ─── constants ──────────────────────────────────────────────── */
const defaultWorker = { name: "", specialization: "Industrial Stitching", experience_years: 2 };
const ASSIGNMENT_TEMPLATES = {
  garment_worker: "Stitch a clean straight seam with consistent margin and explain your quality checks.",
  beauty_professional: "Show a recent beauty service output (hair/mehendi/nail) and explain your process steps.",
  carpenter: "Make a simple joint on scrap wood (butt/half-lap) and explain your tool and marking process.",
  electrician: "Draw a simple 2-way switch circuit for one lamp with L/N/E and explain the logic.",
  domain_unknown: "Complete registration questions about your work preferences and availability.",
};
const DOMAIN_KEYWORDS = {
  electrician: ["electric", "wiring", "bijli", "circuit", "switch", "panel", "mcb", "rccb", "rcbo"],
  beauty_professional: ["beauty", "hair", "mehendi", "henna", "nail", "salon", "makeup"],
  carpenter: ["carpenter", "wood", "furniture", "joinery", "door", "window", "saw", "chisel"],
  garment_worker: ["garment", "tailor", "tailoring", "stitch", "sew", "silai", "kurta", "blouse", "shirt", "pant", "seam"],
};
const detectDomainFromText = (text = "") => {
  const lower = text.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return domain;
  }
  return "domain_unknown";
};
const defaultAssignment = ASSIGNMENT_TEMPLATES.garment_worker;
const INTEGRITY_POLL_MS = 500;
const MULTIFACE_WARNING_MS = 3000;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const HAND_THEME = {
  pointColor: "rgba(34,197,94,0.75)",
  lineColor: "rgba(34,197,94,0.45)",
  pointRadius: 3,
  lineWidth: 1.6,
};
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/* ─── i18n copy ──────────────────────────────────────────────── */
const SRP_COPY = {
  en: {
    vob_skip: "Skip", vob_intro_title: "Hello!", vob_intro_sub: "Tell us your name, trade, and years of experience",
    vob_intro_example: '"My name is Ramu, I am a tailor with 5 years experience"',
    vob_listening_title: "Listening...", vob_listening_sub: "Tell us your name, trade and experience",
    vob_processing_title: "Processing...", vob_processing_sub: "Processing your voice",
    vob_confirm_exp: "yrs experience", vob_confirm_starting: "Starting interview...",
    vob_error_title: "Something went wrong",
    vob_error_voice: "Voice was unclear. Please try again.",
    vob_error_mic: "Microphone not working. Press Skip for manual setup.",
    vob_mic_hint: "Press mic and speak", vob_recording_hint: "Recording... press again to stop",
    vob_tts_welcome: "Hello! I am your Shramik Mitra. Please tell me your name, trade, and years of experience.",
    vob_tts_confirm: (name) => `Your name ${name} has been registered. Ready to start?`,
    setup_kicker: "Configure", setup_title: "Session Setup", setup_worker_label: "Worker",
    setup_new_worker: "Create new worker", setup_name_ph: "Worker full name *",
    setup_spec_ph: "Specialization", setup_exp_ph: "Years of experience",
    setup_assign_label: "Assignment", setup_starting: "Starting...",
    setup_restart: "Restart Session", setup_start: "Start Live Session",
    sidebar_heading: "Session Progress",
    sidebar_tasks: [
      { label: "Session configured", sub: "Worker & assignment set" },
      { label: "Camera ready", sub: "Video feed active" },
      { label: "Integrity monitor on", sub: "MediaPipe running" },
      { label: "First question asked", sub: "AI has spoken" },
      { label: "Worker responded", sub: "First answer captured" },
      { label: "3+ exchanges", sub: "messages" },
      { label: "Snapshot captured", sub_score: "Score", sub_none: "Not yet" },
      { label: "Session complete", sub_final: "Final", sub_end: "End to finish" },
    ],
    sidebar_score: "AI Score", sidebar_reconfigure: "Reconfigure",
    sidebar_setup: "Setup Session", sidebar_end: "End Session",
    mobile_no_session: "No session", mobile_phase: "phase", mobile_end: "End", mobile_setup: "Setup",
    current_q_label: "Current Question", waiting_ai: "Waiting for AI...",
    setup_to_begin: "Set up a session to begin.",
    ai_speaking: "AI Speaking", idle: "Idle",
    live_transcript: "Live Transcript", total: "total",
    transcript_empty: "Transcript appears after session starts.",
    voice_capture: "Voice Capture",
    prior_work_title: "Prior Work (Optional)",
    prior_work_sub: "Upload 1-3 photos to generate grounded questions.",
    prior_work_upload: "Select photos",
    prior_work_note_ph: "Short note about the work (optional)",
    prior_work_send: "Submit",
    prior_work_done: (n) => `Saved. ${n} grounded questions ready.`,
    self_rate_title: "Self-Ratings (Phase 1B)",
    self_rate_send: "Save Ratings",
    self_rate_done: "Self-ratings saved.",
    portfolio_title: "Portfolio Enrichment (Optional)",
    portfolio_sub: "Upload extra samples for recruiter profile depth.",
    portfolio_send: "Add Portfolio",
    portfolio_done: (n) => `Portfolio updated (${n} items).`,
    status_paused: "Interview paused until integrity clears.",
    status_recording: "Recording… tap mic again to stop.",
    status_tap_mic: "Tap the mic to record a spoken answer.",
    status_start_session: "Start a session to enable live voice capture.",
    type_response_ph: "Type worker response here...", send: "Send",
    multi_face_title: "Multiple people detected",
    multi_face_sub: (s) => `Only you should be visible. Pausing in ${s}s...`,
    paused_title: "Interview Paused",
    pause_face_absent: "Face left the frame. Please return to camera.",
    pause_face_change: "Face identity changed. Recruiter verification required.",
    pause_multi: "Multiple faces were detected.",
    resume_btn: "I'm alone — Resume",
    overall_score: "Overall Score", skill_breakdown: "Skill Breakdown",
    rubric: [
      { key: "stitch_quality", label: "Stitch Quality", weight: "32%" },
      { key: "machine_familiarity", label: "Machine Skill", weight: "26%" },
      { key: "technical_knowledge", label: "Technical Know.", weight: "24%" },
      { key: "fabric_material_knowledge", label: "Fabric Knowledge", weight: "12%" },
      { key: "communication_confidence", label: "Communication", weight: "6%" },
      { key: "integrity_compliance", label: "Integrity", weight: "" },
    ],
    integrity_log_heading: "Integrity Log",
    integrity_multiface: "Multi-face", integrity_absent: "Face absent",
    integrity_gaze: "Gaze off", integrity_flag: "Flag", integrity_warning: "warning",
    stitch_snapshot: "Stitch Snapshot", no_snapshot: "No snapshot captured yet.",
    snapshot_btn: "Snapshot", recording: "Recording", no_session_badge: "No Session",
    ai_monitor_on: "AI Monitor On", ai_monitor_off: "AI Monitor Off",
    hands_on: "Hands On", hands_off: "Hands Off",
    log_multiface: "Multiface", log_absent: "Face absent", log_gaze: "Gaze deviation",
    log_change: "Face change", log_flag: "Flag", log_warning: "warning", log_label: "Log",
  },
  hi: {
    vob_skip: "छोड़ें", vob_intro_title: "नमस्ते!", vob_intro_sub: "अपना नाम, काम, और अनुभव बताइए",
    vob_intro_example: '"मेरा नाम रामू है, मैं दर्ज़ी हूँ और 5 साल का अनुभव है"',
    vob_listening_title: "सुन रहा हूँ...", vob_listening_sub: "नाम, काम, और अनुभव बताओ",
    vob_processing_title: "समझ रहा हूँ...", vob_processing_sub: "आपकी आवाज़ प्रोसेस हो रही है",
    vob_confirm_exp: "साल का अनुभव", vob_confirm_starting: "इंटरव्यू शुरू हो रहा है...",
    vob_error_title: "कुछ गड़बड़ हुई",
    vob_error_voice: "आवाज़ साफ नहीं आई। दोबारा कोशिश करें।",
    vob_error_mic: "माइक्रोफ़ोन काम नहीं कर रहा। छोड़ें बटन दबाकर मैनुअल सेटअप करें।",
    vob_mic_hint: "माइक दबाओ और बोलो", vob_recording_hint: "रिकॉर्डिंग... बंद करने के लिए दोबारा दबाओ",
    vob_tts_welcome: "नमस्ते! मैं आपका श्रमिक मित्र हूँ। अपना नाम, काम, और अनुभव बताइए।",
    vob_tts_confirm: (name) => `आपका नाम ${name} रजिस्टर हो गया। इंटरव्यू शुरू करें?`,
    setup_kicker: "सेटअप", setup_title: "सत्र सेटअप", setup_worker_label: "श्रमिक",
    setup_new_worker: "नया श्रमिक बनाएँ", setup_name_ph: "श्रमिक का पूरा नाम *",
    setup_spec_ph: "विशेषज्ञता", setup_exp_ph: "अनुभव (वर्ष)",
    setup_assign_label: "असाइनमेंट", setup_starting: "शुरू हो रहा है...",
    setup_restart: "सत्र पुनः शुरू करें", setup_start: "लाइव सत्र शुरू करें",
    sidebar_heading: "सत्र प्रगति",
    sidebar_tasks: [
      { label: "सत्र सेटअप", sub: "श्रमिक और कार्य तय" },
      { label: "कैमरा तैयार", sub: "वीडियो चालू" },
      { label: "निगरानी चालू", sub: "MediaPipe चल रहा है" },
      { label: "पहला सवाल पूछा", sub: "AI ने बोला" },
      { label: "श्रमिक ने जवाब दिया", sub: "पहला जवाब मिला" },
      { label: "3+ संवाद", sub: "संदेश" },
      { label: "स्नैपशॉट लिया", sub_score: "स्कोर", sub_none: "अभी नहीं" },
      { label: "सत्र पूरा", sub_final: "अंतिम", sub_end: "समाप्त करने के लिए दबाएँ" },
    ],
    sidebar_score: "AI स्कोर", sidebar_reconfigure: "पुनः सेटअप",
    sidebar_setup: "सत्र सेटअप", sidebar_end: "सत्र समाप्त",
    mobile_no_session: "कोई सत्र नहीं", mobile_phase: "चरण", mobile_end: "समाप्त", mobile_setup: "सेटअप",
    current_q_label: "वर्तमान सवाल", waiting_ai: "AI की प्रतीक्षा...",
    setup_to_begin: "सत्र शुरू करने के लिए सेटअप करें।",
    ai_speaking: "AI बोल रहा है", idle: "प्रतीक्षा में",
    live_transcript: "लाइव ट्रांसक्रिप्ट", total: "कुल",
    transcript_empty: "सत्र शुरू होने के बाद ट्रांसक्रिप्ट दिखेगा।",
    voice_capture: "आवाज़ कैप्चर",
    prior_work_title: "पिछला काम (वैकल्पिक)",
    prior_work_sub: "1-3 फोटो अपलोड करें ताकि grounded सवाल बनें।",
    prior_work_upload: "फोटो चुनें",
    prior_work_note_ph: "काम का छोटा नोट (वैकल्पिक)",
    prior_work_send: "सबमिट",
    prior_work_done: (n) => `सेव हो गया। ${n} grounded सवाल तैयार।`,
    self_rate_title: "सेल्फ-रेटिंग (Phase 1B)",
    self_rate_send: "रेटिंग सेव करें",
    self_rate_done: "सेल्फ-रेटिंग सेव हो गई।",
    portfolio_title: "पोर्टफोलियो (वैकल्पिक)",
    portfolio_sub: "रिक्रूटर प्रोफाइल के लिए अतिरिक्त सैंपल अपलोड करें।",
    portfolio_send: "पोर्टफोलियो जोड़ें",
    portfolio_done: (n) => `पोर्टफोलियो अपडेट (${n} items)।`,
    status_paused: "निगरानी मंजूरी तक इंटरव्यू रुका।",
    status_recording: "रिकॉर्डिंग... रोकने के लिए फिर दबाएँ।",
    status_tap_mic: "जवाब देने के लिए माइक दबाएँ।",
    status_start_session: "वॉइस के लिए सत्र शुरू करें।",
    type_response_ph: "यहाँ जवाब टाइप करें...", send: "भेजें",
    multi_face_title: "कई लोग दिखे",
    multi_face_sub: (s) => `केवल आप दिखने चाहिए। ${s} सेकंड में रुकेगा...`,
    paused_title: "इंटरव्यू रुका",
    pause_face_absent: "चेहरा फ्रेम से बाहर गया। कैमरे पर वापस आएँ।",
    pause_face_change: "चेहरा बदल गया। भर्तीकर्ता सत्यापन आवश्यक।",
    pause_multi: "कई चेहरे दिखे।",
    resume_btn: "मैं अकेला हूँ — जारी रखें",
    overall_score: "कुल स्कोर", skill_breakdown: "कौशल विवरण",
    rubric: [
      { key: "stitch_quality", label: "सिलाई गुणवत्ता", weight: "32%" },
      { key: "machine_familiarity", label: "मशीन कौशल", weight: "26%" },
      { key: "technical_knowledge", label: "तकनीकी ज्ञान", weight: "24%" },
      { key: "fabric_material_knowledge", label: "कपड़ा ज्ञान", weight: "12%" },
      { key: "communication_confidence", label: "संवाद", weight: "6%" },
      { key: "integrity_compliance", label: "ईमानदारी", weight: "" },
    ],
    integrity_log_heading: "ईमानदारी लॉग",
    integrity_multiface: "कई चेहरे", integrity_absent: "चेहरा अनुपस्थित",
    integrity_gaze: "नज़र भटकाव", integrity_flag: "चिह्न", integrity_warning: "चेतावनी",
    stitch_snapshot: "सिलाई स्नैपशॉट", no_snapshot: "अभी कोई स्नैपशॉट नहीं।",
    snapshot_btn: "स्नैपशॉट", recording: "रिकॉर्डिंग", no_session_badge: "कोई सत्र नहीं",
    ai_monitor_on: "AI निगरानी चालू", ai_monitor_off: "AI निगरानी बंद",
    hands_on: "हाथ: चालू", hands_off: "हाथ: बंद",
    log_multiface: "कई चेहरे", log_absent: "चेहरा अनुपस्थित", log_gaze: "नज़र भटकाव",
    log_change: "चेहरा परिवर्तन", log_flag: "चिह्न", log_warning: "चेतावनी", log_label: "लॉग",
  },
};

/* ─── face helpers ───────────────────────────────────────────── */
function toPointDistance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}
function buildFaceSignature(detection) {
  if (!detection?.boundingBox) return null;
  const { width, height } = detection.boundingBox;
  const kp = detection.keypoints || [];
  if (kp.length < 2) return null;
  const leftEye = kp[0], rightEye = kp[1], nose = kp[2] || kp[0];
  const eyeDistance = toPointDistance(leftEye, rightEye);
  if (!eyeDistance) return null;
  return {
    eyeDistance, aspectRatio: width / Math.max(height, 1), area: width * height,
    noseXNorm: (nose.x - leftEye.x) / eyeDistance, noseYNorm: (nose.y - leftEye.y) / eyeDistance,
  };
}
function faceChangeScore(baseline, next) {
  if (!baseline || !next) return 0;
  return (
    Math.abs(next.eyeDistance - baseline.eyeDistance) / Math.max(1, baseline.eyeDistance) * 0.15 +
    Math.abs(next.aspectRatio - baseline.aspectRatio) / Math.max(0.01, baseline.aspectRatio) * 0.2 +
    Math.abs(next.area - baseline.area) / Math.max(1, baseline.area) * 0.1 +
    Math.abs(next.noseXNorm - baseline.noseXNorm) * 0.3 +
    Math.abs(next.noseYNorm - baseline.noseYNorm) * 0.25
  );
}

function drawHandOverlay(ctx, handLandmarks, videoW, videoH, canvasW, canvasH) {
  const scale = Math.max(canvasW / Math.max(videoW, 1), canvasH / Math.max(videoH, 1));
  const scaledW = videoW * scale;
  const scaledH = videoH * scale;
  const offsetX = (canvasW - scaledW) / 2;
  const offsetY = (canvasH - scaledH) / 2;
  const toCanvas = (pt) => ({
    x: pt.x * scaledW + offsetX,
    y: pt.y * scaledH + offsetY,
  });

  ctx.strokeStyle = HAND_THEME.lineColor;
  ctx.lineWidth = HAND_THEME.lineWidth;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    const pa = handLandmarks[a];
    const pb = handLandmarks[b];
    if (!pa || !pb) return;
    const ca = toCanvas(pa);
    const cb = toCanvas(pb);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
  });

  ctx.fillStyle = HAND_THEME.pointColor;
  handLandmarks.forEach((pt) => {
    const c = toCanvas(pt);
    ctx.beginPath();
    ctx.arc(c.x, c.y, HAND_THEME.pointRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ─── AI Orb ─────────────────────────────────────────────────── */
function AiOrb({ speaking, paused, score }) {
  const color = paused ? "#3b82f6" : speaking ? "#3b82f6" : "#23314f";
  const glow = paused ? "rgba(59,130,246,0.24)" : speaking ? "rgba(59,130,246,0.2)" : "rgba(35,49,79,0.16)";
  return (
    <div aria-label="AI Interviewer" role="img" className="srp-orb-wrap" style={{ position: "relative", width: 180, height: 180, margin: "0 auto", flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: "-30%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
          animation: paused ? "none" : "orbPulse 3s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "4%",
          borderRadius: "50%",
          border: `1px solid ${color}33`,
          animation: speaking ? "orbitSpin 6s linear infinite" : "none",
        }}
      >
        {speaking && (
          <div
            style={{
              position: "absolute",
              top: -4,
              left: "50%",
              transform: "translateX(-50%)",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: "14%",
          borderRadius: "50%",
          border: `1.5px solid ${color}55`,
          animation: speaking ? "orbRing 1.2s ease-in-out infinite" : paused ? "none" : "orbRingSlow 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "24%",
          borderRadius: "50%",
          border: `1.5px solid ${color}77`,
          animation: speaking ? "orbRing 1.2s ease-in-out infinite 0.15s" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "30%",
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 35%, ${color}ff, ${color}88 55%, ${color}22)`,
          boxShadow: `0 0 32px ${glow}, 0 0 64px ${glow}`,
          animation: speaking ? "orbBeat 0.7s ease-in-out infinite" : paused ? "none" : "orbFloat 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -28,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color,
          whiteSpace: "nowrap",
          opacity: 0.9,
        }}
      >
        {paused ? "Paused" : speaking ? "Speaking" : `Score | ${Math.round(score)}%`}
      </div>
      <style>{`
        @keyframes orbPulse    { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes orbFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes orbBeat     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        @keyframes orbRing     { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.06);opacity:1} }
        @keyframes orbRingSlow { 0%,100%{opacity:.3} 50%{opacity:.7} }
        @keyframes orbitSpin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes waveBar     { 0%,100%{height:3px} 50%{height:100%} }
        @keyframes msgSlideIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes recPulse    { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}
/* ─── voice wave ─────────────────────────────────────────────── */
function VoiceWave({ active, color = "#3b82f6" }) {
  const delays = [0.1, 0.25, 0.0, 0.35, 0.15, 0.4, 0.05, 0.3, 0.2];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 20 }}>
      {delays.map((d, i) => (
        <div key={i} style={{ width: 3, borderRadius: 2, background: active ? color : `${color}33`, height: active ? "100%" : 3, animation: active ? `waveBar ${0.5 + d * 0.8}s ease-in-out infinite ${d}s` : "none", transition: "height 0.2s, background 0.2s" }} />
      ))}
    </div>
  );
}
/* ─── transcript bubble ──────────────────────────────────────── */
function TranscriptMsg({ line }) {
  const { locale } = useLanguage();
  const isAi = line.speaker === "ai";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, animation: "msgSlideIn 0.3s ease forwards" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: isAi ? "rgba(59,130,246,0.78)" : "rgba(35,49,79,0.55)" }}>
        {isAi ? "Shramik AI" : "Worker Response"}
      </span>
      <div style={{ width: "100%", padding: "10px 12px", borderRadius: 14, background: isAi ? "rgba(59,130,246,0.08)" : "rgba(35,49,79,0.04)", border: isAi ? "1px solid rgba(59,130,246,0.16)" : "1px solid rgba(35,49,79,0.08)", fontSize: 13, lineHeight: 1.65, color: "#23314f" }}>
        {line.text}
      </div>
    </div>
  );
}
/* ─── Voice Onboarding Screen ────────────────────────────────── */
function VoiceOnboardingScreen({ onComplete, onSkip }) {
  const { locale, setLocale } = useLanguage();
  const copy = SRP_COPY.hi; // onboarding always starts in Hindi
  const [phase, setPhase] = useState("intro"); // intro | listening | processing | confirm | error
  const [workerInfo, setWorkerInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recRef = useRef(null);

  // Force Hindi for the onboarding screen regardless of cached locale
  useEffect(() => { setLocale("hi"); }, []);

  useEffect(() => {
    (async () => {
      try {
        const blob = await screeningApi.ttsSynthesize(
          copy.vob_tts_welcome,
          "hi-IN"
        );
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.onerror = () => URL.revokeObjectURL(url);
        audio.play().catch(() => {});
      } catch {}
    })();
  }, []);

  const startListening = async () => {
    setPhase("listening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("processing");
        try {
          const raw = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const wav = await blobToWav(raw);
          const fd = new FormData();
          fd.append("file", wav, "audio.wav");
          const stt = await screeningApi.sttTranscribe(fd);
          const text = stt.transcript?.trim();
          if (!text) throw new Error("empty");
          const info = await screeningApi.onboardWorkerByVoice({ voice_transcript: text });
          setWorkerInfo(info);
          setPhase("confirm");
          try {
            const msg = copy.vob_tts_confirm(info.name);
            const ab = await screeningApi.ttsSynthesize(msg, "hi-IN");
            const url = URL.createObjectURL(ab);
            const a = new Audio(url);
            a.onended = () => { URL.revokeObjectURL(url); setTimeout(() => onComplete(info), 1200); };
            a.onerror = () => { URL.revokeObjectURL(url); setTimeout(() => onComplete(info), 1200); };
            a.play().catch(() => setTimeout(() => onComplete(info), 2500));
          } catch {
            setTimeout(() => onComplete(info), 2500);
          }
        } catch {
          setErrorMsg(copy.vob_error_voice);
          setPhase("error");
        }
      };
      recorder.start();
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 15000);
    } catch {
      setErrorMsg(copy.vob_error_mic);
      setPhase("error");
    }
  };

  const stopEarly = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "linear-gradient(160deg, #05102a 0%, #0c1e45 60%, #05102a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "clamp(20px, 5vw, 48px)", overflow: "hidden", fontFamily: "Manrope, sans-serif",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <button onClick={onSkip} style={{
        position: "absolute", top: 16, right: 16,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.45)", borderRadius: 20, padding: "8px 16px",
        fontSize: 12, fontWeight: 600, cursor: "pointer", zIndex: 1,
      }}>
        {copy.vob_skip}
      </button>

      <p style={{ position: "relative", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(59,130,246,0.65)", marginBottom: 28 }}>
        Shramik.ai
      </p>

      <div style={{ position: "relative", marginBottom: 32, flexShrink: 0 }}>
        <AiOrb speaking={phase === "processing"} paused={false} score={0} />
      </div>

      <div style={{ position: "relative", textAlign: "center", maxWidth: 320, marginTop: 12 }}>
        {phase === "intro" && <>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(28px, 6vw, 40px)", color: "#fff", margin: "0 0 12px", lineHeight: 1.1 }}>
            {copy.vob_intro_title}
          </h1>
          <p style={{ fontSize: "clamp(14px, 3vw, 16px)", color: "rgba(255,255,255,0.62)", lineHeight: 1.7, margin: "0 0 6px" }}>
            {copy.vob_intro_sub}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            {copy.vob_intro_example}
          </p>
        </>}
        {phase === "listening" && <>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(22px, 5vw, 32px)", color: "#93c5fd", margin: "0 0 10px" }}>
            {copy.vob_listening_title}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>
            {copy.vob_listening_sub}
          </p>
        </>}
        {phase === "processing" && <>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(22px, 5vw, 32px)", color: "#93c5fd", margin: "0 0 10px" }}>
            {copy.vob_processing_title}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>
            {copy.vob_processing_sub}
          </p>
        </>}
        {phase === "confirm" && workerInfo && <>
          <p style={{ fontSize: 36, margin: "0 0 10px" }}>✓</p>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(22px, 5vw, 32px)", color: "#4ade80", margin: "0 0 8px" }}>
            {workerInfo.name}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", margin: "0 0 6px" }}>
            {workerInfo.specialization} · {workerInfo.experience_years} {copy.vob_confirm_exp}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {copy.vob_confirm_starting}
          </p>
        </>}
        {phase === "error" && <>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(20px, 5vw, 28px)", color: "#f87171", margin: "0 0 10px" }}>
            {copy.vob_error_title}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: "0 0 18px", lineHeight: 1.6 }}>
            {errorMsg}
          </p>
        </>}
      </div>

      <div style={{ position: "relative", marginTop: 36 }}>
        {(phase === "intro" || phase === "error") && (
          <button
            onClick={phase === "error" ? () => setPhase("intro") : startListening}
            style={{
              width: 72, height: 72, borderRadius: "50%", border: "none",
              background: phase === "error" ? "rgba(248,113,113,0.15)" : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
              color: phase === "error" ? "#f87171" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              animation: phase === "intro" ? "vobMicPulse 2s ease-in-out infinite" : "none",
              boxShadow: phase === "intro" ? "0 0 0 0 rgba(59,130,246,0.5)" : "none",
            }}
          >
            <Mic size={28} />
          </button>
        )}
        {phase === "listening" && (
          <button
            onClick={stopEarly}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              border: "2px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.1)",
              color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", animation: "recPulse 1s ease-in-out infinite",
            }}
          >
            <Square size={22} fill="#f87171" />
          </button>
        )}
        {phase === "processing" && (
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "2px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid transparent", borderTopColor: "#3b82f6", animation: "vobSpin 0.8s linear infinite" }} />
          </div>
        )}
      </div>

      {phase === "intro" && (
        <p style={{ position: "relative", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5 }}>
          {copy.vob_mic_hint}
        </p>
      )}
      {phase === "listening" && (
        <p style={{ position: "relative", marginTop: 14, fontSize: 11, color: "rgba(239,68,68,0.6)", letterSpacing: 0.5 }}>
          {copy.vob_recording_hint}
        </p>
      )}

      <style>{`
        @keyframes vobMicPulse {
          0%   { box-shadow: 0 0 0 0   rgba(59,130,246,0.5); }
          70%  { box-shadow: 0 0 0 24px rgba(59,130,246,0);   }
          100% { box-shadow: 0 0 0 0   rgba(59,130,246,0);   }
        }
        @keyframes vobSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ─── setup modal ────────────────────────────────────────────── */
function SetupModal({ open, onClose, workers, selectedWorkerId, setSelectedWorkerId, workerDraft, setWorkerDraft, assignment, onAssignmentChange, onStart, isSubmitting, session }) {
  const { locale } = useLanguage();
  const copy = SRP_COPY[locale] ?? SRP_COPY.en;
  const workerOptions = useMemo(() => workers.map((worker) => ({ id: worker.id, label: `${worker.name} | ${worker.specialization}` })), [workers]);
  const field = { width: "100%", padding: "10px 12px", boxSizing: "border-box", background: "#ffffff", border: "1px solid rgba(35,49,79,0.12)", borderRadius: 14, color: "#23314f", fontSize: 13, outline: "none", fontFamily: "inherit" };
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(18,24,39,0.34)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="srp-modal" style={{ background: "#ffffff", border: "1px solid rgba(35,49,79,0.1)", borderRadius: 24, padding: "clamp(20px,4vw,28px) clamp(16px,4vw,24px)", width: "100%", maxWidth: 460, maxHeight: "90dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 -8px 40px rgba(35,49,79,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#3b82f6", margin: 0 }}>{copy.setup_kicker}</p>
            <h2 style={{ fontSize: 22, fontFamily: "Fraunces, serif", color: "#23314f", margin: "4px 0 0" }}>{copy.setup_title}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#71675d", cursor: "pointer", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#71675d", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>{copy.setup_worker_label}</label>
            <select value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)} style={field}>
              <option value="">{copy.setup_new_worker}</option>
              {workerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          {!selectedWorkerId && (<>
            <input value={workerDraft.name} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder={copy.setup_name_ph} style={field} />
            <input value={workerDraft.specialization} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, specialization: event.target.value }))} placeholder={copy.setup_spec_ph} style={field} />
            <input type="number" min={0} max={50} value={workerDraft.experience_years} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, experience_years: Number(event.target.value) || 0 }))} placeholder={copy.setup_exp_ph} style={field} />
          </>)}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#71675d", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>{copy.setup_assign_label}</label>
            <textarea value={assignment} onChange={(event) => onAssignmentChange(event.target.value)} rows={3} style={{ ...field, resize: "vertical" }} />
          </div>
          <button onClick={onStart} disabled={isSubmitting} style={{ padding: "12px", borderRadius: 999, border: "none", background: isSubmitting ? "#cbd5e1" : "linear-gradient(135deg,#23314f,#3b82f6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", letterSpacing: 0.5, marginTop: 4 }}>
            {isSubmitting ? copy.setup_starting : session?.status === "live" ? copy.setup_restart : copy.setup_start}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function ScreeningRoomPage() {
  const { locale } = useLanguage();
  const copy = SRP_COPY[locale] ?? SRP_COPY.en;
  const { role } = useRole();
  const [voiceOnboardingDone, setVoiceOnboardingDone] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [workerDraft, setWorkerDraft] = useState(defaultWorker);
  const [assignment, setAssignment] = useState(defaultAssignment);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [snapshotNote] = useState("Worker showing seam line and edge finish");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [liveScore, setLiveScore] = useState(50);
  const [transcript, setTranscript] = useState([]);
  const [autoSnapshotOn, setAutoSnapshotOn] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [integrityLog, setIntegrityLog] = useState(null);
  const [integrityPaused, setIntegrityPaused] = useState(false);
  const [integrityPauseReason, setIntegrityPauseReason] = useState(null);
  const [integrityWarningSeconds, setIntegrityWarningSeconds] = useState(0);
  const [integrityReady, setIntegrityReady] = useState(false);
  const [integrityError, setIntegrityError] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textFallbackInput, setTextFallbackInput] = useState("");
  const [currentPhase, setCurrentPhase] = useState("intro");
  const [handOverlayOn, setHandOverlayOn] = useState(true);
  const [autoListenEnabled] = useState(true); // auto-start recording after AI speaks
  const lastAutoAssignmentRef = useRef(defaultAssignment);
  const assignmentTouchedRef = useRef(false);
  const [priorWorkImages, setPriorWorkImages] = useState([]);
  const [priorWorkNote, setPriorWorkNote] = useState("");
  const [priorWorkStatus, setPriorWorkStatus] = useState("");
  const [selfRatings, setSelfRatings] = useState({});
  const [selfRatingStatus, setSelfRatingStatus] = useState("");
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [portfolioNote, setPortfolioNote] = useState("");
  const [portfolioStatus, setPortfolioStatus] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoSnapshotRef = useRef(null);
  const integrityIntervalRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionBusyRef = useRef(false);
  const handLandmarkerRef = useRef(null);
  const handBusyRef = useRef(false);
  const handRafRef = useRef(null);
  const lastHandFrameAtRef = useRef(0);
  const multifaceDeadlineRef = useRef(null);
  const faceAbsentActiveRef = useRef(false);
  const baselineSignatureRef = useRef(null);
  const faceDriftFramesRef = useRef(0);
  const faceChangeLatchedRef = useRef(false);
  const lastIntegrityEventAtRef = useRef({});
  const transcriptListRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceRafRef = useRef(null);
  const autoListenPendingRef = useRef(false);

  const isSessionLive = session?.status === "live";
  const scoreColor = liveScore >= 70 ? "#2563eb" : liveScore >= 45 ? "#3b82f6" : "#93c5fd";
  const visibleTranscript = transcript.slice(-8);
  useEffect(() => {
    if (transcriptListRef.current) {
      transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
    }
  }, [visibleTranscript]);

  useEffect(() => {
    if (session?.self_ratings) {
      setSelfRatings(session.self_ratings);
    }
  }, [session?.id, session?.self_ratings]);

  useEffect(() => {
    const domain = detectDomainFromText(workerDraft.specialization);
    const suggested = ASSIGNMENT_TEMPLATES[domain] ?? defaultAssignment;
    const isAuto = !assignmentTouchedRef.current;
    if (isAuto && suggested !== assignment) {
      setAssignment(suggested);
      lastAutoAssignmentRef.current = suggested;
    }
  }, [workerDraft.specialization]);

  useEffect(() => {
    if (!selectedWorkerId) return;
    const worker = workers.find((w) => w.id === selectedWorkerId);
    if (!worker) return;
    const domain = detectDomainFromText(worker.specialization);
    const suggested = ASSIGNMENT_TEMPLATES[domain] ?? defaultAssignment;
    const isAuto = !assignmentTouchedRef.current;
    if (isAuto && suggested !== assignment) {
      setAssignment(suggested);
      lastAutoAssignmentRef.current = suggested;
    }
  }, [selectedWorkerId, workers]);
  const resetIntegrityState = () => {
    setIntegrityWarningSeconds(0); setIntegrityPaused(false); setIntegrityPauseReason(null);
    setIntegrityReady(false); setIntegrityError("");
    multifaceDeadlineRef.current = null; faceAbsentActiveRef.current = false;
    baselineSignatureRef.current = null; faceDriftFramesRef.current = 0;
    faceChangeLatchedRef.current = false; lastIntegrityEventAtRef.current = {};
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handlePriorWorkFiles = async (files) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 3);
    const urls = await Promise.all(list.map(fileToDataUrl));
    setPriorWorkImages(urls);
    setPriorWorkStatus("");
  };

  const submitPriorWork = async () => {
    if (!session?.id || priorWorkImages.length === 0) return;
    try {
      setPriorWorkStatus("Submitting...");
      const res = await screeningApi.submitPriorWork(session.id, {
        images: priorWorkImages,
        note: priorWorkNote.trim(),
      });
      const count = res?.grounded_questions?.length ?? 0;
      setPriorWorkStatus(copy.prior_work_done(count));
    } catch (err) {
      setPriorWorkStatus("Upload failed. Please try again.");
    }
  };

  const handlePortfolioFiles = async (files) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 8);
    const urls = await Promise.all(list.map(fileToDataUrl));
    setPortfolioImages(urls);
    setPortfolioStatus("");
  };

  const submitPortfolio = async () => {
    if (!session?.id || portfolioImages.length === 0) return;
    try {
      setPortfolioStatus("Submitting...");
      const res = await screeningApi.submitPortfolioEnrichment(session.id, {
        images: portfolioImages,
        note: portfolioNote.trim(),
      });
      setPortfolioStatus(copy.portfolio_done(res?.portfolio_enrichment?.length ?? 0));
    } catch {
      setPortfolioStatus("Upload failed. Please try again.");
    }
  };

  const saveSelfRatings = async () => {
    if (!session?.id) return;
    try {
      const res = await screeningApi.setSelfRatings(session.id, { ratings: selfRatings });
      setSelfRatings(res?.self_ratings || selfRatings);
      setSelfRatingStatus(copy.self_rate_done);
    } catch {
      setSelfRatingStatus("Failed to save self-ratings.");
    }
  };

  useEffect(() => {
    loadWorkers();
    setupCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(autoSnapshotRef.current);
      clearInterval(integrityIntervalRef.current);
      detectorRef.current?.close?.();
      handLandmarkerRef.current?.close?.();
      if (handRafRef.current) cancelAnimationFrame(handRafRef.current);
      window.speechSynthesis.cancel();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      clearTimeout(silenceTimerRef.current);
      if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
      if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close?.();
    };
  }, []);

  useEffect(() => {
    clearInterval(autoSnapshotRef.current);
    if (!session || !cameraReady || !autoSnapshotOn || integrityPaused) return;
    autoSnapshotRef.current = setInterval(() => captureSnapshot(true), 30000);
    return () => clearInterval(autoSnapshotRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, autoSnapshotOn, cameraReady, integrityPaused]);

  useEffect(() => {
    if (!isSessionLive || !cameraReady || !videoRef.current) {
      clearInterval(integrityIntervalRef.current);
      detectorRef.current?.close?.(); detectorRef.current = null; setIntegrityReady(false); return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const detector = await vision.FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: "VIDEO", minDetectionConfidence: 0.55 });
        if (cancelled) { detector.close(); return; }
        detectorRef.current = detector; setIntegrityReady(true);
        integrityIntervalRef.current = setInterval(processIntegrityFrame, INTEGRITY_POLL_MS);
      } catch { setIntegrityError("MediaPipe unavailable."); }
    })();
    return () => { cancelled = true; clearInterval(integrityIntervalRef.current); detectorRef.current?.close?.(); detectorRef.current = null; setIntegrityReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionLive, cameraReady]);

  useEffect(() => {
    if (!cameraReady || !videoRef.current || !handOverlayOn) {
      handLandmarkerRef.current?.close?.(); handLandmarkerRef.current = null;
      if (handRafRef.current) cancelAnimationFrame(handRafRef.current);
      if (handCanvasRef.current) {
        const ctx = handCanvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, handCanvasRef.current.width || 0, handCanvasRef.current.height || 0);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) { handLandmarker.close(); return; }
        handLandmarkerRef.current = handLandmarker;
        const loop = () => {
          if (cancelled) return;
          handRafRef.current = requestAnimationFrame(loop);
          if (handBusyRef.current || !handLandmarkerRef.current || !videoRef.current || !handCanvasRef.current) return;
          if (videoRef.current.readyState < 2 || videoRef.current.videoWidth < 32) return;
          const now = performance.now();
          if (now - lastHandFrameAtRef.current < 33) return;
          lastHandFrameAtRef.current = now;
          handBusyRef.current = true;
          try {
            const result = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
            const canvas = handCanvasRef.current;
            const video = videoRef.current;
            const ctx = canvas.getContext("2d");
            const targetW = canvas.clientWidth || video.videoWidth || 1280;
            const targetH = canvas.clientHeight || video.videoHeight || 720;
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            (result.landmarks || []).forEach((handLandmarks) => {
              drawHandOverlay(
                ctx,
                handLandmarks,
                video.videoWidth || targetW,
                video.videoHeight || targetH,
                targetW,
                targetH
              );
            });
          } catch { } finally { handBusyRef.current = false; }
        };
        loop();
      } catch { }
    })();
    return () => {
      cancelled = true;
      if (handRafRef.current) cancelAnimationFrame(handRafRef.current);
      handLandmarkerRef.current?.close?.(); handLandmarkerRef.current = null;
    };
  }, [cameraReady, handOverlayOn]);

  const postIntegrityEvent = async (event, details = {}, throttleMs = 0) => {
    if (!session?.id) return null;
    const now = Date.now();
    if (throttleMs > 0 && now - (lastIntegrityEventAtRef.current[event] || 0) < throttleMs) return null;
    lastIntegrityEventAtRef.current[event] = now;
    try {
      const res = await screeningApi.sendIntegrityEvent(session.id, { event, details, timestamp: new Date().toISOString() });
      setIntegrityLog(res.integrity_log); setIntegrityPaused(Boolean(res.session_paused)); setIntegrityPauseReason(res.pause_reason || null);
      return res;
    } catch { return null; }
  };

  const processIntegrityFrame = async () => {
    if (!detectorRef.current || !videoRef.current || detectionBusyRef.current || !session?.id || !isSessionLive) return;
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth < 32) return;
    detectionBusyRef.current = true;
    try {
      const detections = detectorRef.current.detectForVideo(videoRef.current, performance.now()).detections || [];
      if (detections.length > 1) {
        if (!multifaceDeadlineRef.current) { multifaceDeadlineRef.current = Date.now() + MULTIFACE_WARNING_MS; await postIntegrityEvent("multi_face_warning", { faces: detections.length }, 1200); }
        setIntegrityWarningSeconds(Math.max(0, Math.ceil((multifaceDeadlineRef.current - Date.now()) / 1000)));
        if (Date.now() >= multifaceDeadlineRef.current) { setIntegrityPaused(true); setIntegrityPauseReason("multiface"); await postIntegrityEvent("multi_face_pause", { faces: detections.length }, 1500); }
        return;
      }
      if (multifaceDeadlineRef.current) { multifaceDeadlineRef.current = null; setIntegrityWarningSeconds(0); await postIntegrityEvent("multi_face_resolved", {}, 1200); }
      if (detections.length === 0) {
        if (!faceAbsentActiveRef.current) { faceAbsentActiveRef.current = true; setIntegrityPaused(true); setIntegrityPauseReason("face_absent"); await postIntegrityEvent("face_absent", {}, 1000); }
        return;
      }
      faceAbsentActiveRef.current = false;
      const sig = buildFaceSignature(detections[0]);
      if (sig && !baselineSignatureRef.current) { baselineSignatureRef.current = sig; }
      else if (sig && baselineSignatureRef.current && !faceChangeLatchedRef.current) {
        const s = faceChangeScore(baselineSignatureRef.current, sig);
        faceDriftFramesRef.current = s > 0.42 ? faceDriftFramesRef.current + 1 : Math.max(0, faceDriftFramesRef.current - 1);
        if (faceDriftFramesRef.current >= 6) { faceChangeLatchedRef.current = true; setIntegrityPaused(true); setIntegrityPauseReason("face_change"); await postIntegrityEvent("face_change", { score: Number(s.toFixed(3)) }, 1000); }
      }
      const box = detections[0]?.boundingBox;
      if (box) {
        const off = Math.abs(box.originX + box.width / 2 - videoRef.current.videoWidth / 2) / Math.max(videoRef.current.videoWidth / 2, 1);
        if (off > 0.45) await postIntegrityEvent("gaze_away", { normalized_offset: Number(off.toFixed(3)) }, 15000);
      }
    } catch { } finally { detectionBusyRef.current = false; }
  };

  const loadWorkers = async () => { try { setWorkers(await screeningApi.listWorkers()); } catch { toast.error("Unable to load workers."); } };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch { setCameraError("Camera/mic blocked. Enable access in browser settings."); toast.error("Camera or microphone permission denied."); }
  };

  const triggerAutoListen = () => {
    if (!autoListenEnabled || autoListenPendingRef.current) return;
    autoListenPendingRef.current = true;
    // Small delay so user hears AI finish before mic opens
    setTimeout(() => {
      autoListenPendingRef.current = false;
      startVoiceInput(true); // true = auto mode with silence detection
    }, 800);
  };

  const speakAi = async (text) => {
    if (!isVoiceEnabled || !text) return;
    setAiSpeaking(true);
    try {
      const audioBlob = await screeningApi.ttsSynthesize(text);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => { setAiSpeaking(false); URL.revokeObjectURL(url); triggerAutoListen(); };
      audio.onerror = () => { setAiSpeaking(false); URL.revokeObjectURL(url); triggerAutoListen(); };
      await audio.play();
    } catch {
      const msg = new SpeechSynthesisUtterance(text);
      msg.onend = () => { setAiSpeaking(false); triggerAutoListen(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    }
  };

  const startLiveSession = async () => {
    if (!assignment.trim()) { toast.error("Please add assignment details."); return; }
    setIsSubmitting(true);
    try {
      let workerId = selectedWorkerId;
      if (!workerId) {
        if (!workerDraft.name.trim()) { toast.error("Select a worker or add worker name."); setIsSubmitting(false); return; }
        const created = await screeningApi.createWorker({ name: workerDraft.name.trim(), specialization: workerDraft.specialization.trim(), experience_years: Number(workerDraft.experience_years) || 0 });
        workerId = created.id; setSelectedWorkerId(created.id); setWorkers(p => [created, ...p]);
      }
      const started = await screeningApi.startSession({ worker_id: workerId, assignment: assignment.trim() }, locale);
      resetIntegrityState();
      setSession(started.session); setIntegrityLog(started.session.integrity_log || null);
      setCurrentQuestion(started.first_question); setLiveScore(started.session.live_score);
      setTranscript(started.session.transcript || []); setSessionDone(false); setSetupOpen(false);
      setCurrentPhase(started.session.current_phase || "intro");
      setShowTextFallback(false); setTextFallbackInput("");
      toast.success("Live screening started.");
      speakAi(started.first_question);
    } catch { toast.error("Could not start screening session."); }
    finally { setIsSubmitting(false); }
  };

  const submitWorkerTurn = async (explicitText, acousticConf = null) => {
    const text = explicitText?.trim();
    if (!session || !text || integrityPaused) return;
    setIsSubmitting(true);
    try {
      setTranscript(p => [...p, { speaker: "worker", text, timestamp: new Date().toISOString() }]);
      const res = await screeningApi.sendTurn(session.id, {
        worker_text: text,
        acoustic_confidence: acousticConf,
      }, locale);
      setCurrentQuestion(res.ai_question);
      setLiveScore(res.live_score);
      if (res.phase) setCurrentPhase(res.phase);
      setTranscript(p => [...p, { speaker: "ai", text: res.ai_question, timestamp: new Date().toISOString() }]);
      speakAi(res.ai_question);
    } catch { toast.error("Could not send worker response."); }
    finally { setIsSubmitting(false); setIsListening(false); }
  };

  const stopSilenceDetection = () => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
    silenceRafRef.current = null;
    if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close?.();
    audioContextRef.current = null;
    analyserRef.current = null;
  };

  const startSilenceDetection = (stream, onSilence) => {
    const SILENCE_THRESHOLD = 15;   // audio level below this = silence
    const SILENCE_DURATION = 3000;  // 3s of silence = stop
    const SPEECH_STARTED_MIN = 500; // must speak at least 500ms before silence triggers

    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    let speechStartedAt = 0;
    let silentSince = 0;

    const check = () => {
      if (!analyserRef.current) return;
      silenceRafRef.current = requestAnimationFrame(check);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;

      if (avg > SILENCE_THRESHOLD) {
        // Speaking
        if (!speechStartedAt) speechStartedAt = Date.now();
        silentSince = 0;
      } else {
        // Silent
        if (speechStartedAt && !silentSince) silentSince = Date.now();
        if (speechStartedAt && silentSince && Date.now() - silentSince > SILENCE_DURATION && Date.now() - speechStartedAt > SPEECH_STARTED_MIN) {
          onSilence();
          return;
        }
      }
    };
    check();
  };

  const startVoiceInput = async (autoMode = false) => {
    if (integrityPaused) { if (!autoMode) toast.error("Interview paused."); return; }
    if (!isSessionLive && autoMode) return;

    // If already recording, stop it
    if (isListening && mediaRecorderRef.current) {
      stopSilenceDetection();
      mediaRecorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        stopSilenceDetection();
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setIsListening(false);
        try {
          const rawBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const wavBlob = await blobToWav(rawBlob);
          const formData = new FormData();
          formData.append("file", wavBlob, "audio.wav");
          const result = await screeningApi.sttTranscribe(formData);
          if (result.transcript?.trim()) {
            submitWorkerTurn(result.transcript.trim());
          }
        } catch {
          if (!autoMode) toast.error("Transcription failed — use text input below.");
          setShowTextFallback(true);
        }
      };

      setIsListening(true);
      recorder.start();

      // Silence detection: auto-stop when worker stops talking
      startSilenceDetection(stream, () => {
        if (recorder.state === "recording") recorder.stop();
      });

      // Hard limit: auto-stop after 45s
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 45000);
    } catch {
      setIsListening(false);
      if (!autoMode) {
        toast.error("Microphone access failed — use text input below.");
        setShowTextFallback(true);
      }
    }
  };

  const captureSnapshot = async (isAuto = false) => {
    if (!session || integrityPaused || !videoRef.current || !canvasRef.current) return;
    try {
      const canvas = canvasRef.current, video = videoRef.current;
      canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const result = await screeningApi.captureSnapshot(session.id, { image_data: canvas.toDataURL("image/jpeg", 0.75), note: snapshotNote });
      setLatestSnapshot(result); setLiveScore(result.live_score);
      if (!isAuto) toast.success("Snapshot captured and assessed.");
    } catch { if (!isAuto) toast.error("Snapshot assessment failed."); }
  };

  const resumeAfterPause = async () => {
    if (!session || !integrityPaused) return;
    if (integrityPauseReason === "face_change") { toast.error("Face-change flag needs recruiter review."); return; }
    const res = await postIntegrityEvent("resume", {}, 0);
    if (res || !integrityLog?.face_change_detected) { setIntegrityPaused(false); setIntegrityPauseReason(null); setIntegrityWarningSeconds(0); toast.success("Interview resumed."); }
  };

  const finishScreening = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const done = await screeningApi.completeSession(session.id, locale);
      setSession(done.session); setIntegrityLog(done.session.integrity_log || integrityLog);
      setLiveScore(done.session.live_score); setSessionDone(true);
      toast.success(`Screening complete: ${done.session.recommendation.toUpperCase()}`);
    } catch { toast.error("Could not complete session."); }
    finally { setIsSubmitting(false); }
  };

  const handleVoiceOnboardComplete = async (workerData) => {
    setVoiceOnboardingDone(true);
    setIsSubmitting(true);
    try {
      const started = await screeningApi.startSession({ worker_id: workerData.id, assignment: assignment.trim() }, locale);
      resetIntegrityState();
      setSession(started.session); setIntegrityLog(started.session.integrity_log || null);
      setCurrentQuestion(started.first_question); setLiveScore(started.session.live_score);
      setTranscript(started.session.transcript || []); setSessionDone(false); setSetupOpen(false);
      setCurrentPhase(started.session.current_phase || "intro");
      setShowTextFallback(false); setTextFallbackInput("");
      toast.success("Live screening started.");
      speakAi(started.first_question);
    } catch {
      toast.error("Could not start screening session.");
      setVoiceOnboardingDone(false);
    } finally { setIsSubmitting(false); }
  };

  /* ─── styles ─── */
  const inputBase = {
    background: "#ffffff", border: "1px solid rgba(35,49,79,0.12)",
    borderRadius: 16, color: "#23314f", fontSize: 13, lineHeight: 1.5,
    fontFamily: "'DM Sans', sans-serif", resize: "none",
    padding: "9px 13px", outline: "none", width: "100%", boxSizing: "border-box",
  };
  const iconBtn = (active, activeColor = "#23314f") => ({
    width: 38, height: 38, borderRadius: "50%", border: "none",
    background: active ? `${activeColor}12` : "rgba(35,49,79,0.06)",
    color: active ? activeColor : "#7d7266",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s", flexShrink: 0,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap');
        .srp { font-family: 'Manrope', sans-serif !important; }
        .srp * { box-sizing: border-box; }
        .srp ::-webkit-scrollbar { width: 3px; }
        .srp ::-webkit-scrollbar-thumb { background: rgba(35,49,79,0.12); border-radius: 4px; }
        .srp textarea:focus, .srp input:focus { border-color: rgba(59,130,246,0.4) !important; }
        .srp textarea::placeholder { color: rgba(113,103,93,0.7); }
        .srp-mobile-bar { display: none; }
        .srp-mobile-caption { display: none; }
        .srp-mobile-voice-bar { display: none; }
        .srp-mobile-ai-half { display: none; }
        .srp-mobile-mic-float { display: none; }
        @media (max-width: 768px) {
          .srp-sidebar { display: none !important; }
          .srp-split { flex-direction: column !important; border-radius: 0 !important; border: none !important; box-shadow: none !important; margin: 0 !important; }
          /* Hide desktop left panel on mobile */
          .srp-left { display: none !important; }
          /* Video = bottom half */
          .srp-right { order: 2 !important; width: 100% !important; flex: 1 !important; min-height: 0 !important; border-right: none !important; border-bottom: none !important; }
          .srp { overflow-x: hidden !important; }
          .srp-mobile-bar { display: none !important; }
          .srp-mobile-end-btn { padding: 6px 12px !important; font-size: 11px !important; min-height: 36px !important; }
          .srp-video-badge { display: none !important; }
          .srp-snapshot-bar { display: none !important; }
          .srp-mobile-caption { display: flex !important; }
          .srp-mobile-voice-bar { display: flex !important; }
          /* Show AI half on mobile */
          .srp-mobile-ai-half { display: flex !important; order: 1 !important; }
          .srp-mobile-mic-float { display: flex !important; }
          .srp-modal { border-radius: 20px 20px 0 0 !important; max-height: 92dvh !important; }
        }
        @media (min-width: 769px) {
          .srp-mobile-bar { display: none !important; }
          .srp-mobile-caption { display: none !important; }
          .srp-mobile-voice-bar { display: none !important; }
          .srp-mobile-ai-half { display: none !important; }
        }
      `}</style>

      {!voiceOnboardingDone && !session && (
        <VoiceOnboardingScreen
          onComplete={handleVoiceOnboardComplete}
          onSkip={() => { setVoiceOnboardingDone(true); setSetupOpen(true); }}
        />
      )}

      <div className="srp" style={{
        height: "100dvh",
        background: "#ffffff",
        color: "#23314f",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* ── Floating action buttons — desktop only ── */}
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 50,
          alignItems: "center", gap: 8,
        }} className="hidden md:flex">
          <button
            onClick={() => setSetupOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999,
              border: "1px solid rgba(35,49,79,0.14)",
              background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
              color: "#23314f", fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 12px rgba(35,49,79,0.08)",
            }}
          >
            <Settings size={12} />
            {session ? copy.sidebar_reconfigure : copy.sidebar_setup}
          </button>
          {isSessionLive && (
            <button
              onClick={finishScreening}
              disabled={isSubmitting}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999,
                border: "1px solid rgba(59,130,246,0.25)",
                background: "rgba(239,246,255,0.95)", backdropFilter: "blur(8px)",
                color: "#3b82f6", fontSize: 12, fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 12px rgba(59,130,246,0.1)",
              }}
            >
              <Square size={10} fill="#3b82f6" />
              {copy.sidebar_end}
            </button>
          )}
        </div>

        {/* Mobile top bar — hidden on desktop */}
        <div className="srp-mobile-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isSessionLive ? "#3b82f6" : "#cbd5e1", flexShrink: 0, animation: isSessionLive ? "recPulse 1.5s ease-in-out infinite" : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#23314f", whiteSpace: "nowrap", textTransform: "capitalize" }}>
              {session ? `${currentPhase} ${copy.mobile_phase}` : copy.mobile_no_session}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{Math.round(liveScore)}%</span>
            {isSessionLive && (
              <button onClick={finishScreening} disabled={isSubmitting} className="srp-mobile-end-btn" style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {copy.mobile_end}
              </button>
            )}
            {!session && (
              <button onClick={() => setSetupOpen(true)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: "rgba(35,49,79,0.08)", color: "#23314f", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {copy.mobile_setup}
              </button>
            )}
          </div>
        </div>

        <div className="srp-split" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, border: "1px solid rgba(35,49,79,0.08)", borderRadius: 28, background: "#ffffff", boxShadow: "0 20px 48px rgba(35,49,79,0.08)" }}>

          {/* ════ TASK CHECKLIST SIDEBAR ════ */}
          <aside className="srp-sidebar" aria-label="Session Progress" style={{
            width: sidebarOpen ? 200 : 36, flexShrink: 0,
            borderRight: "1px solid rgba(35,49,79,0.08)",
            background: "#ffffff",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.25s ease",
          }}>
            {/* Collapse toggle */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "Hide logs" : "Show logs"}
              style={{
                flexShrink: 0, width: "100%", padding: "10px 0",
                border: "none", borderBottom: "1px solid rgba(35,49,79,0.08)",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-end" : "center",
                paddingRight: sidebarOpen ? 10 : 0,
                color: "rgba(35,49,79,0.4)", fontSize: 13,
              }}
            >
              {sidebarOpen ? "←" : "☰"}
            </button>
            {sidebarOpen && <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid rgba(35,49,79,0.08)", flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(113,103,93,0.7)", margin: 0 }}>
                {copy.sidebar_heading}
              </p>
              {session && (
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 20, padding: "3px 9px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "capitalize" }}>
                    {currentPhase}
                  </span>
                </div>
              )}
            </div>}

            {sidebarOpen && <><div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
              {copy.sidebar_tasks.map((t, i) => {
                const doneArr = [!!session, cameraReady, integrityReady, transcript.length > 0, transcript.some(x => x.speaker === "worker"), transcript.length >= 6, !!latestSnapshot, sessionDone];
                const done = doneArr[i];
                const sub = i === 5 ? `${Math.min(transcript.length, 6)}/6 ${t.sub}`
                  : i === 6 ? (latestSnapshot ? `${t.sub_score} ${Math.round(latestSnapshot.quality_score)}%` : t.sub_none)
                  : i === 7 ? (sessionDone ? `${t.sub_final}: ${Math.round(liveScore)}%` : t.sub_end)
                  : t.sub;
                const task = { label: t.label, done, sub };
                return (
                <div key={i} style={{
                  display: "flex", gap: 9, padding: "8px 6px",
                  borderRadius: 10, marginBottom: 1,
                  background: task.done ? "rgba(59,130,246,0.06)" : "transparent",
                  transition: "background 0.4s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    border: `1.5px solid ${task.done ? "#3b82f6" : "rgba(35,49,79,0.14)"}`,
                    background: task.done ? "rgba(59,130,246,0.12)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.4s",
                    boxShadow: task.done ? "0 0 8px rgba(59,130,246,0.16)" : "none",
                  }}>
                    {task.done && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.2L4.2 7.4L8 3" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: 11, fontWeight: task.done ? 600 : 400, margin: 0, lineHeight: 1.35,
                      color: task.done ? "#23314f" : "rgba(113,103,93,0.76)",
                      transition: "color 0.4s",
                    }}>{task.label}</p>
                    <p style={{
                      fontSize: 9.5, margin: "2px 0 0", lineHeight: 1.3,
                      color: task.done ? "rgba(59,130,246,0.8)" : "rgba(113,103,93,0.6)",
                    }}>{task.sub}</p>
                  </div>
                </div>
              ); })}
            </div>

                        <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(35,49,79,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(113,103,93,0.7)" }}>{copy.sidebar_score}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{Math.round(liveScore)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(35,49,79,0.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: scoreColor, width: `${liveScore}%`, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <button onClick={() => setSetupOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(35,49,79,0.14)", background: "#ffffff", color: "#23314f", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Settings size={12} />
                  {session ? copy.sidebar_reconfigure : copy.sidebar_setup}
                </button>
                {isSessionLive && (
                  <button onClick={finishScreening} disabled={isSubmitting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer" }}>
                    <Square size={10} fill="#3b82f6" />
                    {copy.sidebar_end}
                  </button>
                )}
              </div>
            </div></>}
          </aside>

          {/* ════ MOBILE AI HALF — orb + caption (white bg, no mic) ════ */}
          <section className="srp-mobile-ai-half" style={{
            width: "100%", height: "50dvh", flexShrink: 0,
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "#ffffff",
            position: "relative", overflow: "hidden",
            borderBottom: "1px solid rgba(35,49,79,0.08)",
          }}>
            {/* score + phase pill */}
            <div style={{ position: "absolute", top: 10, left: 14, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor }}>{Math.round(liveScore)}%</span>
              {session && <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(113,103,93,0.5)", textTransform: "capitalize" }}>{currentPhase}</span>}
            </div>
            {/* end / setup button */}
            <div style={{ position: "absolute", top: 10, right: 14, zIndex: 2 }}>
              {isSessionLive ? (
                <button onClick={finishScreening} disabled={isSubmitting} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {copy.mobile_end}
                </button>
              ) : !session && (
                <button onClick={() => setSetupOpen(true)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(35,49,79,0.12)", background: "rgba(35,49,79,0.04)", color: "#23314f", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {copy.mobile_setup}
                </button>
              )}
            </div>

            {/* Orb — smaller for mobile */}
            <div style={{ position: "relative", zIndex: 1, transform: "scale(0.55)", marginTop: -14, marginBottom: -24 }}>
              <AiOrb speaking={aiSpeaking} paused={integrityPaused} score={liveScore} />
            </div>

            {/* Voice wave indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <VoiceWave active={aiSpeaking} color="#3b82f6" />
              <span style={{ fontSize: 9, color: "rgba(59,130,246,0.65)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                {aiSpeaking ? copy.ai_speaking : copy.idle}
              </span>
            </div>

            {/* Caption — current AI question */}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 24px", maxWidth: 340 }}>
              <p style={{
                fontSize: 14, color: "#23314f", lineHeight: 1.6, margin: 0,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
              }}>
                {currentQuestion || (session ? copy.waiting_ai : copy.setup_to_begin)}
              </p>
            </div>
          </section>

          {/* ════ LEFT — AI Orb + Transcript ════ */}
          <section className="srp-left" aria-label="AI Interviewer and Transcript" style={{
            flex: 1, height: "100%",
            display: "flex", flexDirection: "column",
            borderRight: "1px solid rgba(35,49,79,0.08)",
            background: "#ffffff",
            overflow: "hidden",
          }}>

            {/* orb + question */}
            <div className="srp-orb-section" style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 22, padding: "clamp(20px,3.5vw,44px) 24px 20px",
              flexShrink: 0,
            }}>
              <AiOrb speaking={aiSpeaking} paused={integrityPaused} score={liveScore} />

              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(59,130,246,0.72)", margin: "0 0 8px" }}>
                  {copy.current_q_label}
                </p>
                <p style={{ fontSize: "clamp(13px,1.6vw,15px)", color: "#71675d", lineHeight: 1.75, margin: 0, minHeight: 42 }}>
                  {currentQuestion || (session ? copy.waiting_ai : copy.setup_to_begin)}
                </p>
                {session && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>
                    {session.phase0_completed ? "Phase 0 intake complete" : "Phase 0 intake in progress"}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VoiceWave active={aiSpeaking} color="#3b82f6" />
                <span style={{ fontSize: 9, color: "rgba(59,130,246,0.65)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                  {aiSpeaking ? copy.ai_speaking : copy.idle}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(35,49,79,0.04)", flexShrink: 0 }} />

            {/* captions — last 2 messages only */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 20px", minHeight: 0 }}>
              {transcript.length === 0 ? (
                <p style={{ fontSize: 12, color: "rgba(113,103,93,0.6)", textAlign: "center", fontStyle: "italic" }}>
                  {copy.transcript_empty}
                </p>
              ) : (
                transcript.slice(-2).map((line, i) => <TranscriptMsg key={`${line.timestamp}-${i}`} line={line} />)
              )}
            </div>

            {isSessionLive && (
              <div style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(35,49,79,0.08)",
                background: "#f1f5f9",
                flexShrink: 0,
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(59,130,246,0.78)" }}>
                  {copy.self_rate_title}
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                  {Object.entries(selfRatings || {}).map(([key, value]) => (
                    <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#334155" }}>
                      <span>{key}</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.5}
                        value={value}
                        onChange={(e) => setSelfRatings((prev) => ({ ...prev, [key]: Number(e.target.value) || 1 }))}
                        style={{ width: 56, ...inputBase, fontSize: 11, padding: "4px 6px" }}
                      />
                    </label>
                  ))}
                  <button onClick={saveSelfRatings} style={{ ...iconBtn(false, "#3b82f6"), padding: "6px 10px" }}>
                    {copy.self_rate_send}
                  </button>
                </div>
                {selfRatingStatus && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>{selfRatingStatus}</p>}
              </div>
            )}

            {isSessionLive && (
              <div style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(35,49,79,0.08)",
                background: "#f8fafc",
                flexShrink: 0,
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(59,130,246,0.78)" }}>
                  {copy.prior_work_title}
                </p>
                <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  {copy.prior_work_sub}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ ...iconBtn(false, "#3b82f6"), padding: "6px 10px", cursor: "pointer" }}>
                    {copy.prior_work_upload}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => handlePriorWorkFiles(e.target.files)}
                    />
                  </label>
                  <input
                    value={priorWorkNote}
                    onChange={(e) => setPriorWorkNote(e.target.value)}
                    placeholder={copy.prior_work_note_ph}
                    style={{ ...inputBase, minWidth: 220, fontSize: 12 }}
                  />
                  <button
                    onClick={submitPriorWork}
                    disabled={!priorWorkImages.length}
                    style={{
                      ...iconBtn(false, "#3b82f6"),
                      padding: "6px 12px",
                      opacity: priorWorkImages.length ? 1 : 0.5,
                      cursor: priorWorkImages.length ? "pointer" : "not-allowed",
                    }}
                  >
                    {copy.prior_work_send}
                  </button>
                </div>
                {priorWorkStatus && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>{priorWorkStatus}</p>
                )}
              </div>
            )}

            {isSessionLive && (
              <div style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(35,49,79,0.08)",
                background: "#f8fafc",
                flexShrink: 0,
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(59,130,246,0.78)" }}>
                  {copy.portfolio_title}
                </p>
                <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  {copy.portfolio_sub}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ ...iconBtn(false, "#3b82f6"), padding: "6px 10px", cursor: "pointer" }}>
                    {copy.prior_work_upload}
                    <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handlePortfolioFiles(e.target.files)} />
                  </label>
                  <input
                    value={portfolioNote}
                    onChange={(e) => setPortfolioNote(e.target.value)}
                    placeholder={copy.prior_work_note_ph}
                    style={{ ...inputBase, minWidth: 220, fontSize: 12 }}
                  />
                  <button
                    onClick={submitPortfolio}
                    disabled={!portfolioImages.length}
                    style={{
                      ...iconBtn(false, "#3b82f6"),
                      padding: "6px 12px",
                      opacity: portfolioImages.length ? 1 : 0.5,
                      cursor: portfolioImages.length ? "pointer" : "not-allowed",
                    }}
                  >
                    {copy.portfolio_send}
                  </button>
                </div>
                {portfolioStatus && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>{portfolioStatus}</p>}
              </div>
            )}

            <div className="srp-voice-area" style={{
              padding: "12px 14px",
              borderTop: "1px solid rgba(35,49,79,0.08)",
              background: "#ffffff",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(59,130,246,0.78)" }}>
                    {copy.voice_capture}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    {integrityPaused ? copy.status_paused : isListening ? copy.status_recording : isSessionLive ? copy.status_tap_mic : copy.status_start_session}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={startVoiceInput}
                    disabled={!isSessionLive || integrityPaused}
                    title="Start voice capture"
                    className="srp-mic-btn"
                    style={{
                      ...iconBtn(isListening, "#3b82f6"),
                      width: 48,
                      height: 48,
                      opacity: !isSessionLive ? 0.35 : 1,
                      animation: isListening ? "orbPulse 1s ease-in-out infinite" : "none",
                    }}
                  >
                    <Mic size={18} />
                  </button>
                  {isSessionLive && (
                    <button
                      onClick={() => setShowTextFallback(p => !p)}
                      title="Type response instead"
                      style={{ ...iconBtn(showTextFallback), width: 32, height: 32, fontSize: 13, fontWeight: 700 }}
                    >
                      Aa
                    </button>
                  )}
                </div>
              </div>
              {showTextFallback && isSessionLive && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    value={textFallbackInput}
                    onChange={e => setTextFallbackInput(e.target.value)}
                    placeholder={copy.type_response_ph}
                    rows={2}
                    style={{ ...inputBase, flex: 1, fontSize: 12 }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (textFallbackInput.trim()) {
                          submitWorkerTurn(textFallbackInput);
                          setTextFallbackInput("");
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (textFallbackInput.trim()) {
                        submitWorkerTurn(textFallbackInput);
                        setTextFallbackInput("");
                      }
                    }}
                    disabled={!textFallbackInput.trim() || isSubmitting}
                    style={{ padding: "8px 14px", borderRadius: 12, border: "none", background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                  >
                    {copy.send}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ════ RIGHT — Worker Video ════ */}
          <section className="srp-right" aria-label="Worker Video Feed" style={{
            flex: 1, height: "100%",
            display: "flex", flexDirection: "column",
            background: "#ffffff", overflow: "hidden", position: "relative",
          }}>

            {/* video fills section */}
            <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                data-testid="worker-live-video"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scaleX(-1)" }}
              />
              {handOverlayOn && (
                <canvas
                  ref={handCanvasRef}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    transform: "scaleX(-1)",
                  }}
                />
              )}

              {/* camera error */}
              {cameraError && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "#f8fafc", gap: 12,
                }}>
                  <Camera size={32} color="#3b82f6" />
                  <p style={{ fontSize: 13, color: "#71675d", textAlign: "center", maxWidth: 240, lineHeight: 1.6 }}>{cameraError}</p>
                </div>
              )}

              {/* multiface warning */}
              {integrityWarningSeconds > 0 && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(35,49,79,0.76)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24,
                }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#dbeafe", textAlign: "center" }}>{copy.multi_face_title}</p>
                  <p style={{ fontSize: 13, color: "#bfdbfe", textAlign: "center", maxWidth: 280 }}>
                    {copy.multi_face_sub(integrityWarningSeconds)}
                  </p>
                </div>
              )}

              {/* integrity paused */}
              {integrityPaused && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24,
                }}>
                  <ShieldAlert size={40} color="#93c5fd" />
                  <p style={{ fontSize: 17, fontWeight: 700, color: "#dbeafe" }}>{copy.paused_title}</p>
                  <p style={{ fontSize: 13, color: "#bfdbfe", textAlign: "center", maxWidth: 300, lineHeight: 1.65 }}>
                    {integrityPauseReason === "face_absent" ? copy.pause_face_absent
                      : integrityPauseReason === "face_change" ? copy.pause_face_change
                      : copy.pause_multi}
                  </p>
                  {integrityPauseReason !== "face_change" && (
                    <button onClick={resumeAfterPause} style={{
                      padding: "9px 24px", borderRadius: 30, border: "none",
                      background: "#23314f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                      {copy.resume_btn}
                    </button>
                  )}
                </div>
              )}

              {/* session complete — Passport Card */}
              {sessionDone && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(5,10,24,0.98)",
                  overflowY: "auto", display: "flex", alignItems: "flex-start",
                  justifyContent: "center", padding: "16px 12px",
                }}>
                  <PassportCard
                    session={{ ...session, integrity_log: integrityLog }}
                    worker={session ? { id: session.worker_id, name: session.worker_name, specialization: session.assignment } : null}
                  />
                </div>
              )}

              {/* top-left: live badge */}
              <div className="srp-video-badge" style={{
                position: "absolute", top: 14, left: 14,
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 11px", borderRadius: 20,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                border: `1px solid ${isSessionLive ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.07)"}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isSessionLive ? "#3b82f6" : "#1e293b",
                  boxShadow: isSessionLive ? "0 0 6px #3b82f6" : "none",
                  animation: isSessionLive ? "recPulse 1.5s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: isSessionLive ? "#dbeafe" : "#334155" }}>
                  {isSessionLive ? copy.recording : copy.no_session_badge}
                </span>
              </div>

              {/* top-right: integrity eye */}
              <div className="srp-video-badge" style={{
                position: "absolute", top: 14, right: 14,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 20,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.07)",
                fontSize: 10, fontWeight: 600,
                color: integrityReady ? "#3b82f6" : "#3b82f6",
              }}>
                {integrityReady ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {integrityReady ? copy.ai_monitor_on : copy.ai_monitor_off}
              </div>

              <button
                className="srp-video-badge"
                onClick={() => setHandOverlayOn((prev) => !prev)}
                style={{
                  position: "absolute", top: 46, right: 14,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 11px", borderRadius: 20,
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                  border: `1px solid ${handOverlayOn ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.07)"}`,
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
                  color: handOverlayOn ? "#bbf7d0" : "#334155",
                  cursor: "pointer",
                }}
                aria-pressed={handOverlayOn}
                title="Toggle hand landmarks"
              >
                {handOverlayOn ? copy.hands_on : copy.hands_off}
              </button>

              {/* ── Floating mic button on camera — mobile only ── */}
              <div className="srp-mobile-mic-float" style={{
                position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                display: "none", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 10,
              }}>
                {isListening && (
                  <div style={{
                    padding: "4px 12px", borderRadius: 16,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                    fontSize: 11, color: "#f87171", fontWeight: 600,
                    animation: "recPulse 1s ease-in-out infinite",
                  }}>
                    {copy.status_recording}
                  </div>
                )}
                <button
                  onClick={startVoiceInput}
                  disabled={!isSessionLive || integrityPaused}
                  style={{
                    width: 56, height: 56, borderRadius: "50%", border: "none",
                    background: isListening ? "rgba(239,68,68,0.9)" : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
                    color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: !isSessionLive ? "not-allowed" : "pointer",
                    opacity: !isSessionLive ? 0.35 : 1,
                    boxShadow: isListening ? "0 0 0 4px rgba(239,68,68,0.25)" : "0 4px 20px rgba(59,130,246,0.3)",
                  }}
                >
                  {isListening ? <Square size={18} fill="#fff" /> : <Mic size={22} />}
                </button>
              </div>

            </div>

            {/* bottom strip — hidden on mobile */}
            <div className="srp-snapshot-bar" style={{
              flexShrink: 0, padding: "10px 14px",
              borderTop: "1px solid rgba(35,49,79,0.08)",
              background: "#ffffff",
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              {latestSnapshot ? (
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 10,
                  background: "rgba(35,49,79,0.04)", border: "1px solid rgba(35,49,79,0.08)",
                  minWidth: 0,
                }}>
                  <Camera size={12} color="#3b82f6" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: "#71675d", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
                    {latestSnapshot.feedback}
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, flexShrink: 0 }}>
                    {Math.round(latestSnapshot.quality_score)}%
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: "#71675d", flex: 1, fontStyle: "italic", margin: 0 }}>{copy.no_snapshot}</p>
              )}

              <button
                onClick={() => captureSnapshot(false)}
                disabled={!session || !cameraReady || integrityPaused}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 20, border: "none",
                  background: "rgba(59,130,246,0.08)", color: "#3b82f6",
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  cursor: (!session || !cameraReady || integrityPaused) ? "not-allowed" : "pointer",
                  opacity: (!session || !cameraReady) ? 0.35 : 1,
                }}
              >
                <Camera size={12} /> {copy.snapshot_btn}
              </button>

              {integrityLog && (
                <details style={{ position: "relative" }}>
                  <summary style={{
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", listStyle: "none",
                    padding: "6px 12px", borderRadius: 20,
                    background: "rgba(35,49,79,0.05)", border: "1px solid rgba(35,49,79,0.08)",
                    fontSize: 11, fontWeight: 600, color: "#71675d",
                  }}>
                    <ChevronDown size={11} /> {copy.log_label}
                  </summary>
                  <div style={{
                    position: "absolute", bottom: 36, right: 0,
                    background: "#ffffff", border: "1px solid rgba(35,49,79,0.12)",
                    borderRadius: 12, padding: "12px 16px", zIndex: 50,
                    fontSize: 11, lineHeight: 2, color: "#71675d", minWidth: 210,
                    boxShadow: "0 18px 48px rgba(35,49,79,0.18)",
                  }}>
                    <p style={{ margin: 0 }}>{copy.log_multiface}: {integrityLog.multiface_events || 0}</p>
                    <p style={{ margin: 0 }}>{copy.log_absent}: {integrityLog.face_absent_events || 0}</p>
                    <p style={{ margin: 0 }}>{copy.log_gaze}: {integrityLog.gaze_deviation_events || 0}</p>
                    <p style={{ margin: 0 }}>{copy.log_change}: {integrityLog.face_change_detected ? <span style={{ color: "#3b82f6" }}>{copy.log_warning}</span> : "false"}</p>
                    <p style={{ margin: 0 }}>{copy.log_flag}: <strong style={{ color: integrityLog.overall_flag === "clear" ? "#2563eb" : "#3b82f6" }}>{integrityLog.overall_flag || "clear"}</strong></p>
                  </div>
                </details>
              )}
            </div>
          </section>
        </div>
      </div>

      <SetupModal
        open={setupOpen} onClose={() => setSetupOpen(false)}
        workers={workers} selectedWorkerId={selectedWorkerId} setSelectedWorkerId={setSelectedWorkerId}
        workerDraft={workerDraft} setWorkerDraft={setWorkerDraft}
        assignment={assignment}
        onAssignmentChange={(value) => {
          assignmentTouchedRef.current = true;
          setAssignment(value);
        }}
        onStart={startLiveSession} isSubmitting={isSubmitting} session={session}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} data-testid="snapshot-canvas" />
    </>
  );
}
