import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mic, ShieldAlert, ShieldCheck, Square, Settings, X, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { screeningApi } from "@/services/api";

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
  const color = paused ? "#3b82f6" : speaking ? "#3b82f6" : "#23314f";
  const glow = paused ? "rgba(59,130,246,0.24)" : speaking ? "rgba(59,130,246,0.2)" : "rgba(35,49,79,0.16)";
  return (
    <div aria-label="AI Interviewer" role="img" style={{ position: "relative", width: 180, height: 180, margin: "0 auto", flexShrink: 0 }}>
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
/* ─── setup modal ────────────────────────────────────────────── */
function SetupModal({ open, onClose, workers, selectedWorkerId, setSelectedWorkerId, workerDraft, setWorkerDraft, assignment, setAssignment, onStart, isSubmitting, session }) {
  const workerOptions = useMemo(() => workers.map((worker) => ({ id: worker.id, label: `${worker.name} | ${worker.specialization}` })), [workers]);
  const field = { width: "100%", padding: "10px 12px", boxSizing: "border-box", background: "#ffffff", border: "1px solid rgba(35,49,79,0.12)", borderRadius: 14, color: "#23314f", fontSize: 13, outline: "none", fontFamily: "inherit" };
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(18,24,39,0.34)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ background: "#ffffff", border: "1px solid rgba(35,49,79,0.1)", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 32px 80px rgba(35,49,79,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#3b82f6", margin: 0 }}>Configure</p>
            <h2 style={{ fontSize: 22, fontFamily: "Fraunces, serif", color: "#23314f", margin: "4px 0 0" }}>Session Setup</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#71675d", cursor: "pointer", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#71675d", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Worker</label>
            <select value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)} style={field}>
              <option value="">Create new worker</option>
              {workerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          {!selectedWorkerId && (<>
            <input value={workerDraft.name} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Worker full name *" style={field} />
            <input value={workerDraft.specialization} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, specialization: event.target.value }))} placeholder="Specialization" style={field} />
            <input type="number" min={0} max={50} value={workerDraft.experience_years} onChange={(event) => setWorkerDraft((prev) => ({ ...prev, experience_years: Number(event.target.value) || 0 }))} placeholder="Years of experience" style={field} />
          </>)}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#71675d", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Assignment</label>
            <textarea value={assignment} onChange={(event) => setAssignment(event.target.value)} rows={3} style={{ ...field, resize: "vertical" }} />
          </div>
          <button onClick={onStart} disabled={isSubmitting} style={{ padding: "12px", borderRadius: 999, border: "none", background: isSubmitting ? "#cbd5e1" : "linear-gradient(135deg,#23314f,#3b82f6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", letterSpacing: 0.5, marginTop: 4 }}>
            {isSubmitting ? "Starting..." : session?.status === "live" ? "Restart Session" : "Start Live Session"}
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
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textFallbackInput, setTextFallbackInput] = useState("");
  const [currentPhase, setCurrentPhase] = useState("intro");

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
  const transcriptListRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const isSessionLive = session?.status === "live";
  const scoreColor = liveScore >= 70 ? "#2563eb" : liveScore >= 45 ? "#3b82f6" : "#93c5fd";
  const visibleTranscript = transcript.slice(-8);
  useEffect(() => {
    if (transcriptListRef.current) {
      transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
    }
  }, [visibleTranscript]);
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
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
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

  const speakAi = async (text) => {
    if (!isVoiceEnabled || !text) return;
    setAiSpeaking(true);
    try {
      const audioBlob = await screeningApi.ttsSynthesize(text);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => { setAiSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setAiSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      const msg = new SpeechSynthesisUtterance(text);
      msg.onend = () => setAiSpeaking(false);
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
      const started = await screeningApi.startSession({ worker_id: workerId, assignment: assignment.trim() });
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
      });
      setCurrentQuestion(res.ai_question);
      setLiveScore(res.live_score);
      if (res.phase) setCurrentPhase(res.phase);
      setTranscript(p => [...p, { speaker: "ai", text: res.ai_question, timestamp: new Date().toISOString() }]);
      speakAi(res.ai_question);
    } catch { toast.error("Could not send worker response."); }
    finally { setIsSubmitting(false); setIsListening(false); }
  };

  const startVoiceInput = async () => {
    if (integrityPaused) { toast.error("Interview paused."); return; }

    // If already recording, stop it
    if (isListening && mediaRecorderRef.current) {
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
          toast.error("Transcription failed — use text input below.");
          setShowTextFallback(true);
        }
      };

      setIsListening(true);
      recorder.start();
      // Auto-stop after 30s
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 30000);
    } catch {
      setIsListening(false);
      toast.error("Microphone access failed — use text input below.");
      setShowTextFallback(true);
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
      const done = await screeningApi.completeSession(session.id);
      setSession(done.session); setIntegrityLog(done.session.integrity_log || integrityLog);
      setLiveScore(done.session.live_score); setSessionDone(true);
      toast.success(`Screening complete: ${done.session.recommendation.toUpperCase()}`);
    } catch { toast.error("Could not complete session."); }
    finally { setIsSubmitting(false); }
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
        @media (max-width: 700px) {
          .srp-split { flex-direction: column !important; }
          .srp-left, .srp-right { width: 100% !important; min-height: 50dvh !important; border-right: none !important; }
          .srp-left { border-bottom: 1px solid rgba(35,49,79,0.08) !important; }
        }
      `}</style>

      <div className="srp" style={{
        height: "100dvh",
        background: "#ffffff",
        color: "#23314f",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}><div className="srp-split" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, border: "1px solid rgba(35,49,79,0.08)", borderRadius: 28, background: "#ffffff", boxShadow: "0 20px 48px rgba(35,49,79,0.08)" }}>

          {/* ════ TASK CHECKLIST SIDEBAR ════ */}
          <aside aria-label="Session Progress" style={{
            width: 200, flexShrink: 0,
            borderRight: "1px solid rgba(35,49,79,0.08)",
            background: "#ffffff",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid rgba(35,49,79,0.08)", flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(113,103,93,0.7)", margin: 0 }}>
                Session Progress
              </p>
              {session && (
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 20, padding: "3px 9px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "capitalize" }}>
                    {currentPhase}
                  </span>
                </div>
              )}
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
              ))}
            </div>

                        <div style={{ padding: "10px 12px 12px", borderTop: "1px solid rgba(35,49,79,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(113,103,93,0.7)" }}>AI Score</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{Math.round(liveScore)}%</span>
              </div>
              <div style={{ height: 3, background: "rgba(35,49,79,0.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: scoreColor, width: `${liveScore}%`, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <button onClick={() => setSetupOpen(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(35,49,79,0.14)", background: "#ffffff", color: "#23314f", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <Settings size={12} />
                  {session ? "Reconfigure" : "Setup Session"}
                </button>
                {isSessionLive && (
                  <button onClick={finishScreening} disabled={isSubmitting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer" }}>
                    <Square size={10} fill="#3b82f6" />
                    End Session
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* ════ LEFT — AI Orb + Transcript ════ */}
          <section className="srp-left" aria-label="AI Interviewer and Transcript" style={{
            flex: 1, height: "100%",
            display: "flex", flexDirection: "column",
            borderRight: "1px solid rgba(35,49,79,0.08)",
            background: "#ffffff",
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
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(59,130,246,0.72)", margin: "0 0 8px" }}>
                  Current Question
                </p>
                <p style={{ fontSize: "clamp(13px,1.6vw,15px)", color: "#71675d", lineHeight: 1.75, margin: 0, minHeight: 42 }}>
                  {currentQuestion || (session ? "Waiting for AI..." : "Set up a session to begin.")}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VoiceWave active={aiSpeaking} color="#3b82f6" />
                <span style={{ fontSize: 9, color: "rgba(59,130,246,0.65)", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                  {aiSpeaking ? "AI Speaking" : "Idle"}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(35,49,79,0.04)", flexShrink: 0 }} />

            {/* transcript */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "10px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(113,103,93,0.72)" }}>
                  Live Transcript
                </span>
                <span style={{ fontSize: 9, color: "rgba(113,103,93,0.6)" }}>{transcript.length} total</span>
              </div>

              <div ref={transcriptListRef} style={{ flex: 1, overflowY: "auto", padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overscrollBehavior: "contain" }}>
                {transcript.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(113,103,93,0.6)", textAlign: "center", marginTop: 20, fontStyle: "italic" }}>
                    Transcript appears after session starts.
                  </p>
                ) : (
                  visibleTranscript.map((line, i) => <TranscriptMsg key={`${line.timestamp}-${i}`} line={line} />)
                )}
              </div>
            </div>

                        <div style={{
              padding: "12px 14px",
              borderTop: "1px solid rgba(35,49,79,0.08)",
              background: "#ffffff",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "rgba(59,130,246,0.78)" }}>
                    Voice Capture
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    {integrityPaused ? "Interview paused until integrity clears." : isListening ? "Recording… tap mic again to stop." : isSessionLive ? "Tap the mic to record a spoken answer." : "Start a session to enable live voice capture."}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={startVoiceInput}
                    disabled={!isSessionLive || integrityPaused}
                    title="Start voice capture"
                    style={{
                      ...iconBtn(isListening, "#3b82f6"),
                      width: 44,
                      height: 44,
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
                    placeholder="Type worker response here..."
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
                    Send
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
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#dbeafe", textAlign: "center" }}>Multiple people detected</p>
                  <p style={{ fontSize: 13, color: "#bfdbfe", textAlign: "center", maxWidth: 280 }}>
                    Only you should be visible. Pausing in {integrityWarningSeconds}s...
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
                  <p style={{ fontSize: 17, fontWeight: 700, color: "#dbeafe" }}>Interview Paused</p>
                  <p style={{ fontSize: 13, color: "#bfdbfe", textAlign: "center", maxWidth: 300, lineHeight: 1.65 }}>
                    {integrityPauseReason === "face_absent" ? "Face left the frame. Please return to camera."
                      : integrityPauseReason === "face_change" ? "Face identity changed. Recruiter verification required."
                      : "Multiple faces were detected."}
                  </p>
                  {integrityPauseReason !== "face_change" && (
                    <button onClick={resumeAfterPause} style={{
                      padding: "9px 24px", borderRadius: 30, border: "none",
                      background: "#23314f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                      I'm alone - Resume
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
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "#93c5fd", margin: 0 }}>
                    Session Complete
                  </p>
                  <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor, textShadow: `0 0 48px ${scoreColor}66` }}>
                    {Math.round(liveScore)}%
                  </div>
                  <p style={{ fontSize: 12, color: "#71675d", margin: 0 }}>Final AI Score</p>
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
                border: `1px solid ${isSessionLive ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.07)"}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isSessionLive ? "#3b82f6" : "#1e293b",
                  boxShadow: isSessionLive ? "0 0 6px #3b82f6" : "none",
                  animation: isSessionLive ? "recPulse 1.5s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: isSessionLive ? "#dbeafe" : "#334155" }}>
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
                color: integrityReady ? "#3b82f6" : "#3b82f6",
              }}>
                {integrityReady ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {integrityReady ? "AI Monitor On" : "AI Monitor Off"}
              </div>
            </div>

            {/* bottom strip */}
            <div style={{
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
                <p style={{ fontSize: 11, color: "#71675d", flex: 1, fontStyle: "italic", margin: 0 }}>No snapshot captured yet.</p>
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
                <Camera size={12} /> Snapshot
              </button>

              {integrityLog && (
                <details style={{ position: "relative" }}>
                  <summary style={{
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", listStyle: "none",
                    padding: "6px 12px", borderRadius: 20,
                    background: "rgba(35,49,79,0.05)", border: "1px solid rgba(35,49,79,0.08)",
                    fontSize: 11, fontWeight: 600, color: "#71675d",
                  }}>
                    <ChevronDown size={11} /> Log
                  </summary>
                  <div style={{
                    position: "absolute", bottom: 36, right: 0,
                    background: "#ffffff", border: "1px solid rgba(35,49,79,0.12)",
                    borderRadius: 12, padding: "12px 16px", zIndex: 50,
                    fontSize: 11, lineHeight: 2, color: "#71675d", minWidth: 210,
                    boxShadow: "0 18px 48px rgba(35,49,79,0.18)",
                  }}>
                    <p style={{ margin: 0 }}>Multiface: {integrityLog.multiface_events || 0}</p>
                    <p style={{ margin: 0 }}>Face absent: {integrityLog.face_absent_events || 0}</p>
                    <p style={{ margin: 0 }}>Gaze deviation: {integrityLog.gaze_deviation_events || 0}</p>
                    <p style={{ margin: 0 }}>Face change: {integrityLog.face_change_detected ? <span style={{ color: "#3b82f6" }}>warning</span> : "false"}</p>
                    <p style={{ margin: 0 }}>Flag: <strong style={{ color: integrityLog.overall_flag === "clear" ? "#2563eb" : "#3b82f6" }}>{integrityLog.overall_flag || "clear"}</strong></p>
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










