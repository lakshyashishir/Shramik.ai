import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Circle, Mic, Send, Square, Sparkles } from "lucide-react";
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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoSnapshotRef = useRef(null);

  const workerOptions = useMemo(
    () => workers.map((w) => ({ id: w.id, label: `${w.name} • ${w.specialization}` })),
    [workers],
  );

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
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!session || !cameraReady || !autoSnapshotOn) {
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
  }, [session, autoSnapshotOn, cameraReady]);

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
      setSession(started.session);
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
    if (!session || !textToSend) return;

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
    if (!session || !videoRef.current || !canvasRef.current) return;

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

  const finishScreening = async () => {
    if (!session) return;

    setIsSubmitting(true);
    try {
      const completed = await screeningApi.completeSession(session.id);
      setSession(completed.session);
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
                <Badge
                  className="ai-eye bg-accent/10 px-4 py-2 text-accent"
                  data-testid="ai-eye-status-badge"
                >
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
                        disabled={isSubmitting || !session}
                        data-testid="submit-worker-response-button"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send to AI
                      </Button>
                      <Button
                        variant={isListening ? "secondary" : "outline"}
                        onClick={startVoiceInput}
                        disabled={!session}
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
                      disabled={!session || !cameraReady}
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
