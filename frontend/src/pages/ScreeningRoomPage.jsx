import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mic, Send, ShieldAlert, ShieldCheck, Square, Sparkles, Settings, X, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { screeningApi } from "@/services/api";

/* ─── constants ──────────────────────────────────────────────── */
const defaultWorker = { name: "", specialization: "Industrial Stitching", experience_years: 2 };
const defaultAssignment = "Stitch a clean straight seam with consistent margin and explain your quality checks.";
const INTEGRITY_POLL_MS = 500;
const MULTIFACE_WARNING_MS = 3000;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

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

/* ─── AI Orb ─────────────────────────────────────────────────── */
function AiOrb({ speaking, paused, score }) {
  const color = paused ? "#f87171" : speaking ? "#67e8f9" : "#818cf8";
  const glow  = paused ? "rgba(248,113,113,0.4)" : speaking ? "rgba(103,232,249,0.4)" : "rgba(129,140,248,0.3)";
  return (
    <div aria-label="AI Interviewer" role="img"
      style={{ position: "relative", width: 180, height: 180, margin: "0 auto", flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: "-30%", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        animation: paused ? "none" : "orbPulse 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", inset: "4%", borderRadius: "50%",
        border: `1px solid ${color}33`,
        animation: speaking ? "orbitSpin 6s linear infinite" : "none",
      }}>
        {speaking && (
          <div style={{
            position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
            width: 8, height: 8, borderRadius: "50%",
            background: color, boxShadow: `0 0 12px ${color}`,
          }} />
        )}
      </div>
      <div style={{
        position: "absolute", inset: "14%", borderRadius: "50%",
        border: `1.5px solid ${color}55`,
        animation: speaking ? "orbRing 1.2s ease-in-out infinite" : paused ? "none" : "orbRingSlow 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", inset: "24%", borderRadius: "50%",
        border: `1.5px solid ${color}77`,
        animation: speaking ? "orbRing 1.2s ease-in-out infinite 0.15s" : "none",
      }} />
      <div style={{
        position: "absolute", inset: "30%", borderRadius: "50%",
        background: `radial-gradient(circle at 38% 35%, ${color}ff, ${color}88 55%, ${color}22)`,
        boxShadow: `0 0 32px ${glow}, 0 0 64px ${glow}`,
        animation: speaking ? "orbBeat 0.7s ease-in-out infinite" : paused ? "none" : "orbFloat 4s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: -28, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
        color, whiteSpace: "nowrap", opacity: 0.9,
      }}>
        {paused ? "⏸ PAUSED" : speaking ? "● SPEAKING" : `SCORE · ${Math.round(score)}%`}
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
function VoiceWave({ active, color = "#67e8f9" }) {
  const delays = [0.1, 0.25, 0.0, 0.35, 0.15, 0.4, 0.05, 0.3, 0.2];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 20 }}>
      {delays.map((d, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: active ? color : `${color}33`,
          height: active ? "100%" : 3,
          animation: active ? `waveBar ${0.5 + d * 0.8}s ease-in-out infinite ${d}s` : "none",
          transition: "height 0.2s, background 0.2s",
        }} />
      ))}
    </div>
  );
}

/* ─── transcript bubble ──────────────────────────────────────── */
function TranscriptMsg({ line }) {
  const isAi = line.speaker === "ai";
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isAi ? "flex-start" : "flex-end",
      animation: "msgSlideIn 0.3s ease forwards", gap: 4,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
        color: isAi ? "rgba(103,232,249,0.6)" : "rgba(167,139,250,0.6)",
      }}>
        {isAi ? "Shramik AI" : "Worker"}
      </span>
      <div style={{
        maxWidth: "90%", padding: "9px 13px",
        borderRadius: isAi ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
        background: isAi ? "rgba(103,232,249,0.07)" : "rgba(167,139,250,0.07)",
        border: `1px solid ${isAi ? "rgba(103,232,249,0.18)" : "rgba(167,139,250,0.18)"}`,
        fontSize: 13, lineHeight: 1.65,
        color: isAi ? "#e0f7fb" : "#ede9fe",
      }}>
        {line.text}
      </div>
    </div>
  );
}

/* ─── setup modal ────────────────────────────────────────────── */
function SetupModal({ open, onClose, workers, selectedWorkerId, setSelectedWorkerId, workerDraft, setWorkerDraft, assignment, setAssignment, onStart, isSubmitting, session }) {
  const workerOptions = useMemo(() => workers.map(w => ({ id: w.id, label: `${w.name} · ${w.specialization}` })), [workers]);
  const field = {
    width: "100%", padding: "9px 12px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit",
  };
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 460,
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#818cf8", margin: 0 }}>Configure</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: "4px 0 0" }}>Session Setup</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Worker</label>
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)} style={field}>
              <option value="">— Create new —</option>
              {workerOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          {!selectedWorkerId && (<>
            <input value={workerDraft.name} onChange={e => setWorkerDraft(p => ({ ...p, name: e.target.value }))} placeholder="Worker full name *" style={field} />
            <input value={workerDraft.specialization} onChange={e => setWorkerDraft(p => ({ ...p, specialization: e.target.value }))} placeholder="Specialization" style={field} />
            <input type="number" min={0} max={50} value={workerDraft.experience_years} onChange={e => setWorkerDraft(p => ({ ...p, experience_years: Number(e.target.value) || 0 }))} placeholder="Years of experience" style={field} />
          </>)}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Assignment</label>
            <textarea value={assignment} onChange={e => setAssignment(e.target.value)} rows={3} style={{ ...field, resize: "vertical" }} />
          </div>
          <button onClick={onStart} disabled={isSubmitting} style={{
            padding: "12px", borderRadius: 30, border: "none",
            background: isSubmitting ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: isSubmitting ? "not-allowed" : "pointer", letterSpacing: 0.5, marginTop: 4,
          }}>
            {isSubmitting ? "Starting…" : session?.status === "live" ? "Restart Session" : "Start Live Session"}
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
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [workerDraft, setWorkerDraft] = useState(defaultWorker);
  const [assignment, setAssignment] = useState(defaultAssignment);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [workerText, setWorkerText] = useState("");
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
  const [setupOpen, setSetupOpen] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [integrityLog, setIntegrityLog] = useState(null);
  const [integrityPaused, setIntegrityPaused] = useState(false);
  const [integrityPauseReason, setIntegrityPauseReason] = useState(null);
  const [integrityWarningSeconds, setIntegrityWarningSeconds] = useState(0);
  const [integrityReady, setIntegrityReady] = useState(false);
  const [integrityError, setIntegrityError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoSnapshotRef = useRef(null);
  const integrityIntervalRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionBusyRef = useRef(false);
  const multifaceDeadlineRef = useRef(null);
  const faceAbsentActiveRef = useRef(false);
  const baselineSignatureRef = useRef(null);
  const faceDriftFramesRef = useRef(0);
  const faceChangeLatchedRef = useRef(false);
  const lastIntegrityEventAtRef = useRef({});
  const transcriptEndRef = useRef(null);

  const isSessionLive = session?.status === "live";
  const scoreColor = liveScore >= 70 ? "#4ade80" : liveScore >= 45 ? "#facc15" : "#f87171";

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);

  const resetIntegrityState = () => {
    setIntegrityWarningSeconds(0); setIntegrityPaused(false); setIntegrityPauseReason(null);
    setIntegrityReady(false); setIntegrityError("");
    multifaceDeadlineRef.current = null; faceAbsentActiveRef.current = false;
    baselineSignatureRef.current = null; faceDriftFramesRef.current = 0;
    faceChangeLatchedRef.current = false; lastIntegrityEventAtRef.current = {};
  };

  useEffect(() => {
    loadWorkers();
    setupCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(autoSnapshotRef.current);
      clearInterval(integrityIntervalRef.current);
      detectorRef.current?.close?.();
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    clearInterval(autoSnapshotRef.current);
    if (!session || !cameraReady || !autoSnapshotOn || integrityPaused) return;
    autoSnapshotRef.current = setInterval(() => captureSnapshot(true), 30000);
    return () => clearInterval(autoSnapshotRef.current);
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
  }, [isSessionLive, cameraReady]);

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

  const speakAi = (text) => {
    if (!isVoiceEnabled || !text) return;
    setAiSpeaking(true);
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1; msg.pitch = 1;
    msg.onend = () => setAiSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
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
      const started = await screeningApi.startSession({ worker_id: workerId, assignment: assignment.trim() });
      resetIntegrityState();
      setSession(started.session); setIntegrityLog(started.session.integrity_log || null);
      setCurrentQuestion(started.first_question); setLiveScore(started.session.live_score);
      setTranscript(started.session.transcript || []); setSessionDone(false); setSetupOpen(false);
      toast.success("Live screening started.");
      speakAi(started.first_question);
    } catch { toast.error("Could not start screening session."); }
    finally { setIsSubmitting(false); }
  };

  const submitWorkerTurn = async (explicitText) => {
    const text = (explicitText || workerText).trim();
    if (!session || !text || integrityPaused) return;
    setIsSubmitting(true);
    try {
      setTranscript(p => [...p, { speaker: "worker", text, timestamp: new Date().toISOString() }]);
      const res = await screeningApi.sendTurn(session.id, { worker_text: text });
      setCurrentQuestion(res.ai_question); setLiveScore(res.live_score);
      setTranscript(p => [...p, { speaker: "ai", text: res.ai_question, timestamp: new Date().toISOString() }]);
      setWorkerText(""); speakAi(res.ai_question);
      toast.success(res.coach_note || "AI generated next question.");
    } catch { toast.error("Could not send worker response."); }
    finally { setIsSubmitting(false); setIsListening(false); }
  };

  const startVoiceInput = () => {
    if (integrityPaused) { toast.error("Interview paused."); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported."); return; }
    const rec = new SR(); rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
    let final = ""; setIsListening(true);
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript + " "; };
    rec.onerror = () => { setIsListening(false); toast.error("Voice capture failed."); };
    rec.onend = () => { if (final.trim()) submitWorkerTurn(final); else setIsListening(false); };
    rec.start();
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
      const done = await screeningApi.completeSession(session.id);
      setSession(done.session); setIntegrityLog(done.session.integrity_log || integrityLog);
      setLiveScore(done.session.live_score); setSessionDone(true);
      toast.success(`Screening complete: ${done.session.recommendation.toUpperCase()}`);
    } catch { toast.error("Could not complete session."); }
    finally { setIsSubmitting(false); }
  };

  /* ─── styles ─── */
  const inputBase = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, color: "#f1f5f9", fontSize: 13, lineHeight: 1.5,
    fontFamily: "'DM Sans', sans-serif", resize: "none",
    padding: "9px 13px", outline: "none", width: "100%", boxSizing: "border-box",
  };
  const iconBtn = (active, activeColor = "#818cf8") => ({
    width: 38, height: 38, borderRadius: "50%", border: "none",
    background: active ? `${activeColor}20` : "rgba(255,255,255,0.04)",
    color: active ? activeColor : "#475569",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s", flexShrink: 0,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .srp { font-family: 'DM Sans', sans-serif !important; }
        .srp * { box-sizing: border-box; }
        .srp ::-webkit-scrollbar { width: 3px; }
        .srp ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .srp textarea:focus, .srp input:focus { border-color: rgba(129,140,248,0.4) !important; }
        .srp textarea::placeholder { color: rgba(100,116,139,0.6); }
        @media (max-width: 700px) {
          .srp-split { flex-direction: column !important; }
          .srp-left, .srp-right { width: 100% !important; min-height: 50dvh !important; border-right: none !important; }
          .srp-left { border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
        }
      `}</style>

      <div className="srp" style={{
        height: "calc(100dvh - 65px)",
        background: "#07090f",
        color: "#f1f5f9",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* ══ top bar ══ */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: 52, flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(7,9,15,0.9)", backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isSessionLive ? "#f87171" : "#1e293b",
                boxShadow: isSessionLive ? "0 0 8px #f87171" : "none",
                animation: isSessionLive ? "recPulse 1.5s ease-in-out infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: isSessionLive ? "#f87171" : "#334155" }}>
                {isSessionLive ? "Live" : "Standby"}
              </span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>Shramik.ai Screening Room</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* integrity pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              background: integrityReady ? "rgba(74,222,128,0.07)" : "rgba(251,191,36,0.07)",
              border: `1px solid ${integrityReady ? "rgba(74,222,128,0.18)" : "rgba(251,191,36,0.18)"}`,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
              color: integrityReady ? "#4ade80" : "#fbbf24",
            }}>
              {integrityReady ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
              {integrityReady ? "Integrity On" : "Integrity Off"}
            </div>

            {/* score pill */}
            {isSessionLive && (
              <div style={{
                padding: "4px 12px", borderRadius: 20,
                background: `${scoreColor}10`, border: `1px solid ${scoreColor}25`,
                fontSize: 11, fontWeight: 700, color: scoreColor, letterSpacing: 1,
              }}>
                {Math.round(liveScore)}%
              </div>
            )}

            <button onClick={() => setSetupOpen(true)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(129,140,248,0.2)",
              background: "rgba(129,140,248,0.07)", color: "#818cf8",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              <Settings size={12} />
              {session ? "Reconfigure" : "Setup"}
            </button>

            {isSessionLive && (
              <button onClick={finishScreening} disabled={isSubmitting} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(248,113,113,0.2)",
                background: "rgba(248,113,113,0.07)", color: "#f87171",
                fontSize: 11, fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer",
              }}>
                <Square size={10} fill="#f87171" />
                End Session
              </button>
            )}
          </div>
        </header>

        {/* ══ split layout ══ */}
        <div className="srp-split" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* ════ TASK CHECKLIST SIDEBAR ════ */}
          <aside aria-label="Session Progress" style={{
            width: 200, flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(5,7,9,0.98)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(100,116,139,0.45)", margin: 0 }}>
                Session Progress
              </p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
              {[
                { label: "Session configured",  done: !!session,                                      sub: "Worker & assignment set" },
                { label: "Camera ready",         done: cameraReady,                                   sub: "Video feed active" },
                { label: "Integrity monitor on", done: integrityReady,                                sub: "MediaPipe running" },
                { label: "First question asked", done: transcript.length > 0,                         sub: "AI has spoken" },
                { label: "Worker responded",     done: transcript.some(t => t.speaker === "worker"),  sub: "First answer captured" },
                { label: "3+ exchanges",         done: transcript.length >= 6,                        sub: `${Math.min(transcript.length, 6)}/6 messages` },
                { label: "Snapshot captured",    done: !!latestSnapshot,                              sub: latestSnapshot ? `Score ${Math.round(latestSnapshot.quality_score)}%` : "Not yet" },
                { label: "Session complete",     done: sessionDone,                                   sub: sessionDone ? `Final: ${Math.round(liveScore)}%` : "End to finish" },
              ].map((task, i) => (
                <div key={i} style={{
                  display: "flex", gap: 9, padding: "8px 6px",
                  borderRadius: 10, marginBottom: 1,
                  background: task.done ? "rgba(74,222,128,0.04)" : "transparent",
                  transition: "background 0.4s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                    border: `1.5px solid ${task.done ? "#4ade80" : "rgba(100,116,139,0.2)"}`,
                    background: task.done ? "rgba(74,222,128,0.12)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.4s",
                    boxShadow: task.done ? "0 0 8px rgba(74,222,128,0.2)" : "none",
                  }}>
                    {task.done && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.2L4.2 7.4L8 3" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: 11, fontWeight: task.done ? 600 : 400, margin: 0, lineHeight: 1.35,
                      color: task.done ? "#e2e8f0" : "rgba(100,116,139,0.5)",
                      transition: "color 0.4s",
                    }}>{task.label}</p>
                    <p style={{
                      fontSize: 9.5, margin: "2px 0 0", lineHeight: 1.3,
                      color: task.done ? "rgba(74,222,128,0.55)" : "rgba(100,116,139,0.3)",
                    }}>{task.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(100,116,139,0.4)" }}>AI Score</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{Math.round(liveScore)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: `linear-gradient(90deg, ${scoreColor}66, ${scoreColor})`,
                  width: `${liveScore}%`, transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          </aside>

          {/* ════ LEFT — AI Orb + Transcript ════ */}
          <section className="srp-left" aria-label="AI Interviewer and Transcript" style={{
            flex: 1, height: "100%",
            display: "flex", flexDirection: "column",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            background: "radial-gradient(ellipse at 40% 15%, rgba(99,102,241,0.07) 0%, transparent 55%), #07090f",
            overflow: "hidden",
          }}>

            {/* orb + question */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 22, padding: "clamp(20px,3.5vw,44px) 24px 20px",
              flexShrink: 0,
            }}>
              <AiOrb speaking={aiSpeaking} paused={integrityPaused} score={liveScore} />

              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(129,140,248,0.5)", margin: "0 0 8px" }}>
                  Current Question
                </p>
                <p style={{ fontSize: "clamp(13px,1.6vw,15px)", color: "#94a3b8", lineHeight: 1.75, margin: 0, minHeight: 42 }}>
                  {currentQuestion || (session ? "Waiting for AI…" : "Set up a session to begin.")}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VoiceWave active={aiSpeaking} color="#67e8f9" />
                <span style={{ fontSize: 9, color: "rgba(103,232,249,0.45)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                  {aiSpeaking ? "AI Speaking" : "Idle"}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />

            {/* transcript */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "10px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(100,116,139,0.5)" }}>
                  Live Transcript
                </span>
                <span style={{ fontSize: 9, color: "rgba(100,116,139,0.35)" }}>{transcript.length} msgs</span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                {transcript.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(100,116,139,0.35)", textAlign: "center", marginTop: 20, fontStyle: "italic" }}>
                    Transcript appears after session starts.
                  </p>
                ) : (
                  transcript.map((line, i) => <TranscriptMsg key={`${line.timestamp}-${i}`} line={line} />)
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* response input */}
            <div style={{
              padding: "10px 14px 12px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(7,9,15,0.85)", backdropFilter: "blur(8px)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={workerText}
                  onChange={e => setWorkerText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitWorkerTurn(); } }}
                  placeholder={integrityPaused ? "Session paused…" : !isSessionLive ? "Start a session first…" : "Worker response… (Enter to send)"}
                  disabled={!isSessionLive || integrityPaused}
                  rows={2}
                  style={inputBase}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <button
                    onClick={startVoiceInput}
                    disabled={!isSessionLive || integrityPaused}
                    title="Voice input"
                    style={{
                      ...iconBtn(isListening, "#67e8f9"),
                      opacity: !isSessionLive ? 0.35 : 1,
                      animation: isListening ? "orbPulse 1s ease-in-out infinite" : "none",
                    }}
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    onClick={() => submitWorkerTurn()}
                    disabled={!isSessionLive || isSubmitting || integrityPaused || !workerText.trim()}
                    title="Send"
                    style={{ ...iconBtn(!!workerText.trim() && isSessionLive, "#818cf8"), opacity: !isSessionLive ? 0.35 : 1 }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { icon: <Sparkles size={10} />, label: isVoiceEnabled ? "Voice On" : "Voice Off", active: isVoiceEnabled, onClick: () => setIsVoiceEnabled(p => !p), color: "#818cf8" },
                  { icon: <Camera size={10} />, label: autoSnapshotOn ? "Snap On" : "Snap Off", active: autoSnapshotOn, onClick: () => setAutoSnapshotOn(p => !p), color: "#67e8f9" },
                ].map(b => (
                  <button key={b.label} onClick={b.onClick} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 9px", borderRadius: 20, border: "none",
                    background: b.active ? `${b.color}10` : "rgba(255,255,255,0.03)",
                    color: b.active ? b.color : "#334155",
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                  }}>
                    {b.icon}{b.label}
                  </button>
                ))}
                {integrityError && <span style={{ fontSize: 10, color: "#fbbf24", lineHeight: "24px" }}>{integrityError}</span>}
              </div>
            </div>
          </section>

          {/* ════ RIGHT — Worker Video ════ */}
          <section className="srp-right" aria-label="Worker Video Feed" style={{
            flex: 1, height: "100%",
            display: "flex", flexDirection: "column",
            background: "#050709", overflow: "hidden", position: "relative",
          }}>

            {/* video fills section */}
            <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                data-testid="worker-live-video"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scaleX(-1)" }}
              />

              {/* camera error */}
              {cameraError && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "#050709", gap: 12,
                }}>
                  <Camera size={32} color="#1e293b" />
                  <p style={{ fontSize: 13, color: "#334155", textAlign: "center", maxWidth: 240, lineHeight: 1.6 }}>{cameraError}</p>
                </div>
              )}

              {/* multiface warning */}
              {integrityWarningSeconds > 0 && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(113,63,18,0.8)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24,
                }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#fde68a", textAlign: "center" }}>Multiple people detected</p>
                  <p style={{ fontSize: 13, color: "#fef3c7", textAlign: "center", maxWidth: 280 }}>
                    Only you should be visible. Pausing in {integrityWarningSeconds}s…
                  </p>
                </div>
              )}

              {/* integrity paused */}
              {integrityPaused && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24,
                }}>
                  <ShieldAlert size={40} color="#f87171" />
                  <p style={{ fontSize: 17, fontWeight: 700, color: "#fca5a5" }}>Interview Paused</p>
                  <p style={{ fontSize: 13, color: "#fecaca", textAlign: "center", maxWidth: 300, lineHeight: 1.65 }}>
                    {integrityPauseReason === "face_absent" ? "Face left the frame. Please return to camera."
                      : integrityPauseReason === "face_change" ? "Face identity changed. Recruiter verification required."
                      : "Multiple faces were detected."}
                  </p>
                  {integrityPauseReason !== "face_change" && (
                    <button onClick={resumeAfterPause} style={{
                      padding: "9px 24px", borderRadius: 30, border: "none",
                      background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                      I'm alone — Resume
                    </button>
                  )}
                </div>
              )}

              {/* session complete */}
              {sessionDone && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "#4ade80", margin: 0 }}>
                    Session Complete
                  </p>
                  <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor, textShadow: `0 0 48px ${scoreColor}66` }}>
                    {Math.round(liveScore)}%
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Final AI Score</p>
                  {session?.recommendation && (
                    <div style={{
                      padding: "7px 20px", borderRadius: 20,
                      background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`,
                      fontSize: 12, fontWeight: 700, color: scoreColor, textTransform: "uppercase", letterSpacing: 1.5,
                    }}>
                      {session.recommendation}
                    </div>
                  )}
                </div>
              )}

              {/* top-left: live badge */}
              <div style={{
                position: "absolute", top: 14, left: 14,
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 11px", borderRadius: 20,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                border: `1px solid ${isSessionLive ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.07)"}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isSessionLive ? "#f87171" : "#1e293b",
                  boxShadow: isSessionLive ? "0 0 6px #f87171" : "none",
                  animation: isSessionLive ? "recPulse 1.5s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: isSessionLive ? "#fca5a5" : "#334155" }}>
                  {isSessionLive ? "Recording" : "No Session"}
                </span>
              </div>

              {/* top-right: integrity eye */}
              <div style={{
                position: "absolute", top: 14, right: 14,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 20,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.07)",
                fontSize: 10, fontWeight: 600,
                color: integrityReady ? "#4ade80" : "#fbbf24",
              }}>
                {integrityReady ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {integrityReady ? "AI Eye On" : "AI Eye Off"}
              </div>
            </div>

            {/* bottom strip */}
            <div style={{
              flexShrink: 0, padding: "10px 14px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(5,7,9,0.95)",
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              {latestSnapshot ? (
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  minWidth: 0,
                }}>
                  <Camera size={12} color="#67e8f9" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
                    {latestSnapshot.feedback}
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, flexShrink: 0 }}>
                    {Math.round(latestSnapshot.quality_score)}%
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: "#1e293b", flex: 1, fontStyle: "italic", margin: 0 }}>No snapshot yet.</p>
              )}

              <button
                onClick={() => captureSnapshot(false)}
                disabled={!session || !cameraReady || integrityPaused}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 20, border: "none",
                  background: "rgba(103,232,249,0.07)", color: "#67e8f9",
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  cursor: (!session || !cameraReady || integrityPaused) ? "not-allowed" : "pointer",
                  opacity: (!session || !cameraReady) ? 0.35 : 1,
                }}
              >
                <Camera size={12} /> Snapshot
              </button>

              {integrityLog && (
                <details style={{ position: "relative" }}>
                  <summary style={{
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", listStyle: "none",
                    padding: "6px 12px", borderRadius: 20,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 11, fontWeight: 600, color: "#475569",
                  }}>
                    <ChevronDown size={11} /> Log
                  </summary>
                  <div style={{
                    position: "absolute", bottom: 36, right: 0,
                    background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12, padding: "12px 16px", zIndex: 50,
                    fontSize: 11, lineHeight: 2, color: "#64748b", minWidth: 210,
                    boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                  }}>
                    <p style={{ margin: 0 }}>Multiface: {integrityLog.multiface_events || 0}</p>
                    <p style={{ margin: 0 }}>Face absent: {integrityLog.face_absent_events || 0}</p>
                    <p style={{ margin: 0 }}>Gaze deviation: {integrityLog.gaze_deviation_events || 0}</p>
                    <p style={{ margin: 0 }}>Face change: {integrityLog.face_change_detected ? <span style={{ color: "#f87171" }}>⚠ true</span> : "false"}</p>
                    <p style={{ margin: 0 }}>Flag: <strong style={{ color: integrityLog.overall_flag === "clear" ? "#4ade80" : "#f87171" }}>{integrityLog.overall_flag || "clear"}</strong></p>
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
        assignment={assignment} setAssignment={setAssignment}
        onStart={startLiveSession} isSubmitting={isSubmitting} session={session}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} data-testid="snapshot-canvas" />
    </>
  );
}
