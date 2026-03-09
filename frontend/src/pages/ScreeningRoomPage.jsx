import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Circle, Mic, Send, ShieldAlert, ShieldCheck, Square, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { screeningApi } from "@/services/api";

const defaultWorker = {
  name: "",
  specialization: "Industrial Stitching",
  experience_years: 2,
};

const defaultAssignment = "Stitch a clean straight seam with consistent margin and explain your quality checks.";
const INTEGRITY_POLL_MS = 500;
const MULTIFACE_WARNING_MS = 3000;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

function toPointDistance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function buildFaceSignature(detection) {
  if (!detection?.boundingBox) return null;
  const { width, height } = detection.boundingBox;
  const keypoints = detection.keypoints || [];
  if (keypoints.length < 2) return null;

  const leftEye = keypoints[0];
  const rightEye = keypoints[1];
  const nose = keypoints[2] || leftEye;
  const eyeDistance = toPointDistance(leftEye, rightEye);
  if (!eyeDistance) return null;

  return {
    eyeDistance,
    aspectRatio: width / Math.max(height, 1),
    area: width * height,
    noseXNorm: (nose.x - leftEye.x) / eyeDistance,
    noseYNorm: (nose.y - leftEye.y) / eyeDistance,
  };
}

function faceChangeScore(baseline, next) {
  if (!baseline || !next) return 0;
  const eyeDelta = Math.abs(next.eyeDistance - baseline.eyeDistance) / Math.max(1, baseline.eyeDistance);
  const aspectDelta = Math.abs(next.aspectRatio - baseline.aspectRatio) / Math.max(0.01, baseline.aspectRatio);
  const areaDelta = Math.abs(next.area - baseline.area) / Math.max(1, baseline.area);
  const noseXDelta = Math.abs(next.noseXNorm - baseline.noseXNorm);
  const noseYDelta = Math.abs(next.noseYNorm - baseline.noseYNorm);

  return (eyeDelta * 0.15) + (aspectDelta * 0.2) + (areaDelta * 0.1) + (noseXDelta * 0.3) + (noseYDelta * 0.25);
}

export default function ScreeningRoomPage() {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [workerDraft, setWorkerDraft] = useState(defaultWorker);
  const [assignment, setAssignment] = useState(defaultAssignment);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [workerText, setWorkerText] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("Worker showing seam line and edge finish");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [liveScore, setLiveScore] = useState(50);
  const [transcript, setTranscript] = useState([]);
  const [autoSnapshotOn, setAutoSnapshotOn] = useState(true);
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

  const workerOptions = useMemo(
    () => workers.map((w) => ({ id: w.id, label: `${w.name} • ${w.specialization}` })),
    [workers],
  );

  const isSessionLive = session?.status === "live";

  const resetIntegrityState = () => {
    setIntegrityWarningSeconds(0);
    setIntegrityPaused(false);
    setIntegrityPauseReason(null);
    setIntegrityReady(false);
    setIntegrityError("");
    multifaceDeadlineRef.current = null;
    faceAbsentActiveRef.current = false;
    baselineSignatureRef.current = null;
    faceDriftFramesRef.current = 0;
    faceChangeLatchedRef.current = false;
    lastIntegrityEventAtRef.current = {};
  };

  useEffect(() => {
    loadWorkers();
    setupCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (autoSnapshotRef.current) {
        clearInterval(autoSnapshotRef.current);
      }
      if (integrityIntervalRef.current) {
        clearInterval(integrityIntervalRef.current);
      }
      if (detectorRef.current?.close) {
        detectorRef.current.close();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!session || !cameraReady || !autoSnapshotOn || integrityPaused) {
      if (autoSnapshotRef.current) {
        clearInterval(autoSnapshotRef.current);
      }
      return;
    }

    autoSnapshotRef.current = setInterval(() => {
      captureSnapshot(true);
    }, 30000);

    return () => {
      if (autoSnapshotRef.current) {
        clearInterval(autoSnapshotRef.current);
      }
    };
  }, [session, autoSnapshotOn, cameraReady, integrityPaused]);

  useEffect(() => {
    if (!isSessionLive || !cameraReady || !videoRef.current) {
      if (integrityIntervalRef.current) {
        clearInterval(integrityIntervalRef.current);
      }
      if (detectorRef.current?.close) {
        detectorRef.current.close();
      }
      detectorRef.current = null;
      setIntegrityReady(false);
      return;
    }

    let cancelled = false;

    const startMonitor = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const detector = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.55,
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        setIntegrityReady(true);

        integrityIntervalRef.current = setInterval(() => {
          processIntegrityFrame();
        }, INTEGRITY_POLL_MS);
      } catch (error) {
        setIntegrityError("MediaPipe integrity monitor unavailable.");
        setIntegrityReady(false);
      }
    };

    startMonitor();

    return () => {
      cancelled = true;
      if (integrityIntervalRef.current) {
        clearInterval(integrityIntervalRef.current);
      }
      if (detectorRef.current?.close) {
        detectorRef.current.close();
      }
      detectorRef.current = null;
      setIntegrityReady(false);
    };
  }, [isSessionLive, cameraReady]);

  const postIntegrityEvent = async (event, details = {}, throttleMs = 0) => {
    if (!session?.id) return null;

    const now = Date.now();
    const lastAt = lastIntegrityEventAtRef.current[event] || 0;
    if (throttleMs > 0 && now - lastAt < throttleMs) {
      return null;
    }

    lastIntegrityEventAtRef.current[event] = now;

    try {
      const response = await screeningApi.sendIntegrityEvent(session.id, {
        event,
        details,
        timestamp: new Date().toISOString(),
      });
      setIntegrityLog(response.integrity_log);
      setIntegrityPaused(Boolean(response.session_paused));
      setIntegrityPauseReason(response.pause_reason || null);
      return response;
    } catch (error) {
      return null;
    }
  };

  const processIntegrityFrame = async () => {
    if (!detectorRef.current || !videoRef.current || detectionBusyRef.current || !session?.id || !isSessionLive) return;
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth < 32) return;

    detectionBusyRef.current = true;

    try {
      const detections = detectorRef.current.detectForVideo(videoRef.current, performance.now()).detections || [];

      if (detections.length > 1) {
        if (!multifaceDeadlineRef.current) {
          multifaceDeadlineRef.current = Date.now() + MULTIFACE_WARNING_MS;
          await postIntegrityEvent("multi_face_warning", { faces: detections.length }, 1200);
        }

        const seconds = Math.max(0, Math.ceil((multifaceDeadlineRef.current - Date.now()) / 1000));
        setIntegrityWarningSeconds(seconds);

        if (Date.now() >= multifaceDeadlineRef.current) {
          setIntegrityPaused(true);
          setIntegrityPauseReason("multiface");
          await postIntegrityEvent("multi_face_pause", { faces: detections.length }, 1500);
        }
        return;
      }

      if (multifaceDeadlineRef.current) {
        multifaceDeadlineRef.current = null;
        setIntegrityWarningSeconds(0);
        await postIntegrityEvent("multi_face_resolved", {}, 1200);
      }

      if (detections.length === 0) {
        if (!faceAbsentActiveRef.current) {
          faceAbsentActiveRef.current = true;
          setIntegrityPaused(true);
          setIntegrityPauseReason("face_absent");
          await postIntegrityEvent("face_absent", {}, 1000);
        }
        return;
      }

      faceAbsentActiveRef.current = false;

      const detection = detections[0];
      const signature = buildFaceSignature(detection);
      if (signature && !baselineSignatureRef.current) {
        baselineSignatureRef.current = signature;
      } else if (signature && baselineSignatureRef.current && !faceChangeLatchedRef.current) {
        const score = faceChangeScore(baselineSignatureRef.current, signature);
        if (score > 0.42) {
          faceDriftFramesRef.current += 1;
        } else {
          faceDriftFramesRef.current = Math.max(0, faceDriftFramesRef.current - 1);
        }

        if (faceDriftFramesRef.current >= 6) {
          faceChangeLatchedRef.current = true;
          setIntegrityPaused(true);
          setIntegrityPauseReason("face_change");
          await postIntegrityEvent("face_change", { score: Number(score.toFixed(3)) }, 1000);
        }
      }

      const box = detection?.boundingBox;
      if (box) {
        const centerX = box.originX + (box.width / 2);
        const frameCenterX = videoRef.current.videoWidth / 2;
        const normalizedOffset = Math.abs(centerX - frameCenterX) / Math.max(frameCenterX, 1);

        if (normalizedOffset > 0.45) {
          await postIntegrityEvent("gaze_away", { normalized_offset: Number(normalizedOffset.toFixed(3)) }, 15000);
        }
      }
    } catch (error) {
      // Skip transient frame errors to keep interview running.
    } finally {
      detectionBusyRef.current = false;
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await screeningApi.listWorkers();
      setWorkers(data);
    } catch (error) {
      toast.error("Unable to load workers.");
    }
  };

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (error) {
      setCameraError("Camera/mic permission blocked. Enable access for live screening.");
      toast.error("Camera or microphone permission denied.");
    }
  };

  const speakAi = (text) => {
    if (!isVoiceEnabled || !text) return;
    const message = new SpeechSynthesisUtterance(text);
    message.rate = 1;
    message.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(message);
  };

  const startLiveSession = async () => {
    if (!assignment.trim()) {
      toast.error("Please add assignment details.");
      return;
    }

    setIsSubmitting(true);
    try {
      let workerId = selectedWorkerId;
      if (!workerId) {
        if (!workerDraft.name.trim()) {
          toast.error("Select a worker or add worker name.");
          setIsSubmitting(false);
          return;
        }
        const created = await screeningApi.createWorker({
          name: workerDraft.name.trim(),
          specialization: workerDraft.specialization.trim(),
          experience_years: Number(workerDraft.experience_years) || 0,
        });
        workerId = created.id;
        setSelectedWorkerId(created.id);
        setWorkers((prev) => [created, ...prev]);
      }

      const started = await screeningApi.startSession({ worker_id: workerId, assignment: assignment.trim() });
      resetIntegrityState();
      setSession(started.session);
      setIntegrityLog(started.session.integrity_log || null);
      setCurrentQuestion(started.first_question);
      setLiveScore(started.session.live_score);
      setTranscript(started.session.transcript || []);
      toast.success("Live screening started.");
      speakAi(started.first_question);
    } catch (error) {
      toast.error("Could not start screening session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWorkerTurn = async (explicitText) => {
    const textToSend = (explicitText || workerText).trim();
    if (!session || !textToSend || integrityPaused) return;

    setIsSubmitting(true);
    try {
      const workerLine = {
        speaker: "worker",
        text: textToSend,
        timestamp: new Date().toISOString(),
      };
      setTranscript((prev) => [...prev, workerLine]);

      const response = await screeningApi.sendTurn(session.id, { worker_text: textToSend });
      setCurrentQuestion(response.ai_question);
      setLiveScore(response.live_score);

      const aiLine = {
        speaker: "ai",
        text: response.ai_question,
        timestamp: new Date().toISOString(),
      };
      setTranscript((prev) => [...prev, aiLine]);
      setWorkerText("");
      speakAi(response.ai_question);
      toast.success(response.coach_note || "AI generated next question.");
    } catch (error) {
      toast.error("Could not send worker response.");
    } finally {
      setIsSubmitting(false);
      setIsListening(false);
    }
  };

  const startVoiceInput = () => {
    if (integrityPaused) {
      toast.error("Interview is paused for integrity check.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = "";
    setIsListening(true);

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalText += `${event.results[i][0].transcript} `;
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice capture failed. Try again.");
    };

    recognition.onend = () => {
      if (finalText.trim()) {
        submitWorkerTurn(finalText);
      } else {
        setIsListening(false);
      }
    };

    recognition.start();
  };

  const captureSnapshot = async (isAuto = false) => {
    if (!session || integrityPaused || !videoRef.current || !canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.75);

      const result = await screeningApi.captureSnapshot(session.id, {
        image_data: imageData,
        note: snapshotNote,
      });

      setLatestSnapshot(result);
      setLiveScore(result.live_score);
      if (!isAuto) {
        toast.success("Snapshot captured and assessed.");
      }
    } catch (error) {
      if (!isAuto) {
        toast.error("Snapshot assessment failed.");
      }
    }
  };

  const resumeAfterPause = async () => {
    if (!session || !integrityPaused) return;

    if (integrityPauseReason === "face_change") {
      toast.error("Face-change flag needs recruiter review. Session cannot auto-resume.");
      return;
    }

    const response = await postIntegrityEvent("resume", {}, 0);
    if (response || !integrityLog?.face_change_detected) {
      setIntegrityPaused(false);
      setIntegrityPauseReason(null);
      setIntegrityWarningSeconds(0);
      toast.success("Interview resumed.");
    }
  };

  const finishScreening = async () => {
    if (!session) return;

    setIsSubmitting(true);
    try {
      const completed = await screeningApi.completeSession(session.id);
      setSession(completed.session);
      setIntegrityLog(completed.session.integrity_log || integrityLog);
      setLiveScore(completed.session.live_score);
      toast.success(`Screening complete: ${completed.session.recommendation.toUpperCase()}`);
    } catch (error) {
      toast.error("Could not complete session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1700px] px-4 py-6 md:px-8" data-testid="screening-room-page">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8" data-testid="screening-main-stage">
          <Card className="overflow-hidden border-primary/20 shadow-2xl shadow-primary/10" data-testid="video-stage-card">
            <CardHeader className="border-b border-border/60 bg-white/70 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-heading text-3xl text-primary" data-testid="screening-stage-title">
                    Live Worker Screening Room
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground" data-testid="screening-stage-subtitle">
                    AI voice interviewer + real-time visual presence for tailoring skill assessment.
                  </p>
                </div>
                <Badge className="ai-eye bg-accent/10 px-4 py-2 text-accent" data-testid="ai-eye-status-badge">
                  AI Eye Active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-4 md:p-6">
              <div
                className="scanner-overlay relative aspect-video overflow-hidden rounded-2xl border border-accent/40 bg-primary"
                data-testid="camera-preview-wrapper"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  data-testid="worker-live-video"
                />

                {cameraError ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-white"
                    data-testid="camera-error-message"
                  >
                    {cameraError}
                  </div>
                ) : null}

                {integrityWarningSeconds > 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-950/70 p-5 text-center text-amber-100">
                    <div>
                      <p className="text-lg font-semibold">Multiple people detected</p>
                      <p className="mt-2 text-sm">
                        Please ensure only you are visible. Interview pausing in {integrityWarningSeconds}...
                      </p>
                    </div>
                  </div>
                ) : null}

                {integrityPaused ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-5 text-center text-white">
                    <div className="space-y-3">
                      <p className="text-lg font-semibold">Interview Paused for Integrity Monitoring</p>
                      <p className="text-sm text-white/80">
                        {integrityPauseReason === "face_absent"
                          ? "Face left the frame. Please return to camera."
                          : integrityPauseReason === "face_change"
                            ? "Face identity changed. Recruiter verification required."
                            : "Multiple faces were detected."}
                      </p>
                      <Button
                        onClick={resumeAfterPause}
                        disabled={integrityPauseReason === "face_change"}
                        data-testid="integrity-resume-button"
                      >
                        I&apos;m alone now — Resume
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-white">
                  <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                  <span className="font-mono text-xs" data-testid="session-live-indicator-text">
                    LIVE SCREENING
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-border/60" data-testid="live-score-card">
                  <CardHeader className="pb-3">
                    <p className="font-mono text-xs uppercase text-muted-foreground" data-testid="live-score-label">
                      Current AI score
                    </p>
                    <p className="font-mono text-3xl text-accent" data-testid="live-score-value">
                      {Math.round(liveScore)}%
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Progress value={liveScore} data-testid="live-score-progress" />
                  </CardContent>
                </Card>

                <Card className="border-border/60" data-testid="voice-visualizer-card">
                  <CardHeader className="pb-3">
                    <p className="font-mono text-xs uppercase text-muted-foreground" data-testid="voice-agent-label">
                      Voice agent signal
                    </p>
                    <div className="voice-bars" data-testid="voice-wave-bars">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={isVoiceEnabled ? "default" : "outline"}
                        onClick={() => setIsVoiceEnabled((prev) => !prev)}
                        data-testid="toggle-ai-voice-button"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isVoiceEnabled ? "AI Voice On" : "AI Voice Off"}
                      </Button>
                      <Button
                        variant={autoSnapshotOn ? "secondary" : "outline"}
                        onClick={() => setAutoSnapshotOn((prev) => !prev)}
                        data-testid="toggle-auto-snapshot-button"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {autoSnapshotOn ? "Auto Snapshots On" : "Auto Snapshots Off"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60" data-testid="current-ai-question-card">
                <CardHeader>
                  <p className="font-mono text-xs uppercase text-muted-foreground" data-testid="current-ai-question-label">
                    Current AI Question
                  </p>
                  <p className="text-base md:text-lg" data-testid="current-ai-question-text">
                    {currentQuestion || "Start a session to begin AI interviewing."}
                  </p>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-border/60" data-testid="worker-answer-card">
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid="worker-answer-title">
                      Worker Response
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={workerText}
                      onChange={(event) => setWorkerText(event.target.value)}
                      placeholder="Type worker response or use voice capture"
                      className="min-h-[120px]"
                      data-testid="worker-response-textarea"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => submitWorkerTurn()}
                        disabled={isSubmitting || !session || integrityPaused}
                        data-testid="submit-worker-response-button"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send to AI
                      </Button>
                      <Button
                        variant={isListening ? "secondary" : "outline"}
                        onClick={startVoiceInput}
                        disabled={!session || integrityPaused}
                        data-testid="start-voice-capture-button"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        {isListening ? "Listening..." : "Capture Voice"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60" data-testid="snapshot-assessment-card">
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid="snapshot-assessment-title">
                      Snapshot Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={snapshotNote}
                      onChange={(event) => setSnapshotNote(event.target.value)}
                      className="min-h-[95px]"
                      data-testid="snapshot-note-textarea"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => captureSnapshot(false)}
                      disabled={!session || !cameraReady || integrityPaused}
                      data-testid="capture-snapshot-button"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Capture + Score Snapshot
                    </Button>

                    <div className="rounded-xl border border-border/50 bg-muted/30 p-3" data-testid="latest-snapshot-feedback-block">
                      <p className="font-mono text-xs uppercase text-muted-foreground" data-testid="snapshot-feedback-label">
                        Latest snapshot feedback
                      </p>
                      <p className="mt-2 text-sm" data-testid="snapshot-feedback-text">
                        {latestSnapshot?.feedback || "No snapshot assessed yet."}
                      </p>
                      <p className="mt-1 font-mono text-xs text-accent" data-testid="snapshot-feedback-score">
                        Score: {latestSnapshot ? `${Math.round(latestSnapshot.quality_score)}%` : "--"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  className="h-12 rounded-full px-8"
                  onClick={finishScreening}
                  disabled={!session || isSubmitting}
                  data-testid="finish-screening-button"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Finish Screening
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6 lg:col-span-4" data-testid="screening-sidebar">
          <Card className="border-border/60" data-testid="session-setup-card">
            <CardHeader>
              <CardTitle className="font-heading text-2xl text-primary" data-testid="session-setup-title">
                Session Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" data-testid="worker-select-label">
                Existing worker
              </label>
              <select
                value={selectedWorkerId}
                onChange={(event) => setSelectedWorkerId(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3"
                data-testid="worker-select-input"
              >
                <option value="">Create new worker</option>
                {workerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Input
                value={workerDraft.name}
                onChange={(event) => setWorkerDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Worker full name"
                data-testid="worker-name-input"
              />

              <Input
                value={workerDraft.specialization}
                onChange={(event) => setWorkerDraft((prev) => ({ ...prev, specialization: event.target.value }))}
                placeholder="Specialization"
                data-testid="worker-specialization-input"
              />

              <Input
                type="number"
                min={0}
                max={50}
                value={workerDraft.experience_years}
                onChange={(event) =>
                  setWorkerDraft((prev) => ({ ...prev, experience_years: Number(event.target.value) || 0 }))
                }
                placeholder="Experience years"
                data-testid="worker-experience-input"
              />

              <Textarea
                value={assignment}
                onChange={(event) => setAssignment(event.target.value)}
                className="min-h-[120px]"
                data-testid="assignment-textarea"
              />

              <Button
                onClick={startLiveSession}
                disabled={isSubmitting}
                className="w-full"
                data-testid="start-live-screening-button"
              >
                {session?.status === "live" ? "Restart Session" : "Start Live Session"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60" data-testid="integrity-monitor-card">
            <CardHeader>
              <CardTitle className="text-xl" data-testid="integrity-monitor-title">
                Integrity Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Engine</span>
                <span className="flex items-center gap-1 font-medium">
                  {integrityReady ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
                  {integrityReady ? "MediaPipe Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Poll Interval</span>
                <span className="font-mono">500ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{integrityPaused ? "Paused" : "Monitoring"}</span>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
                <p>multiface_events: {integrityLog?.multiface_events || 0}</p>
                <p>face_absent_events: {integrityLog?.face_absent_events || 0}</p>
                <p>gaze_deviation_events: {integrityLog?.gaze_deviation_events || 0}</p>
                <p>face_change_detected: {integrityLog?.face_change_detected ? "true" : "false"}</p>
                <p>overall_flag: {integrityLog?.overall_flag || "clear"}</p>
              </div>
              {integrityError ? <p className="text-xs text-amber-700">{integrityError}</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/60" data-testid="transcript-card">
            <CardHeader>
              <CardTitle className="text-xl" data-testid="transcript-title">
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1" data-testid="transcript-items-container">
                {transcript.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="transcript-empty-state">
                    Transcript appears here after session starts.
                  </p>
                ) : (
                  transcript.map((line, index) => (
                    <div
                      key={`${line.timestamp}-${index}`}
                      className={`rounded-lg border p-2 text-sm ${
                        line.speaker === "ai" ? "border-accent/40 bg-accent/5" : "border-secondary/40 bg-secondary/5"
                      }`}
                      data-testid={`transcript-line-${index}`}
                    >
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {line.speaker}
                      </p>
                      <p>{line.text}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <canvas ref={canvasRef} className="hidden" data-testid="snapshot-canvas" />
    </main>
  );
}
