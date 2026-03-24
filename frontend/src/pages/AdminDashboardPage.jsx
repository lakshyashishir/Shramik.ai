import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, ChevronDown, ChevronUp, Users, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { screeningApi } from "@/services/api";
import { useLanguage } from "@/i18n/language";

// ── Dummy demo data ───────────────────────────────────────────────────────────
const DUMMY_REPORTS = [
  {
    id: "demo_001",
    worker_name: "Ravi Kumar",
    assignment: "Sew a collar and attach buttons on a formal shirt",
    live_score: 82,
    recommendation: "pass",
    summary: "Ravi demonstrated strong stitch consistency and good knowledge of lockstitch machines. He correctly identified common fabric defects and showed confidence in handling medium-weight cotton. Minor gaps in speed readiness — recommended for onboarding with a brief machine refresher.",
    rubric_scores: {
      stitch_quality: 88,
      machine_familiarity: 80,
      technical_knowledge: 78,
      fabric_material_knowledge: 85,
      communication_confidence: 72,
    },
    integrity_log: {
      overall_flag: "clear",
      multiface_events: 0,
      face_absent_events: 0,
      gaze_deviation_events: 1,
    },
    interview_mode: "web",
    transcript: [
      { speaker: "ai",     text: "नमस्ते! आप किस मशीन पर काम करते हैं?", timestamp: "" },
      { speaker: "worker", text: "मैं जुकी और उषा दोनों मशीन चला सकता हूँ। 5 साल का अनुभव है।", timestamp: "" },
      { speaker: "ai",     text: "अगर धागा बार-बार टूटे तो आप क्या करेंगे?", timestamp: "" },
      { speaker: "worker", text: "पहले टेंशन चेक करूँगा, फिर नीडल और बॉबिन देखूँगा।", timestamp: "" },
      { speaker: "ai",     text: "बहुत अच्छा! कॉलर सिलते समय कौन सी सावधानी रखते हैं?", timestamp: "" },
      { speaker: "worker", text: "कॉलर के कोने पर स्टिच छोटी रखता हूँ और क्लिप से फिक्स करता हूँ।", timestamp: "" },
    ],
  },
  {
    id: "demo_002",
    worker_name: "Sunita Devi",
    assignment: "Attach zipper to a denim trouser waistband",
    live_score: 61,
    recommendation: "hold",
    summary: "Sunita showed basic familiarity with flatbed machines but struggled to explain zipper attachment technique accurately. She was uncertain about seam allowance standards. Integrity check flagged one brief face-absent moment. Recommend a follow-up practical test before making a final decision.",
    rubric_scores: {
      stitch_quality: 62,
      machine_familiarity: 55,
      technical_knowledge: 58,
      fabric_material_knowledge: 70,
      communication_confidence: 65,
    },
    integrity_log: {
      overall_flag: "minor_warning",
      multiface_events: 0,
      face_absent_events: 1,
      gaze_deviation_events: 2,
    },
    interview_mode: "call",
    transcript: [
      { speaker: "ai",     text: "Hello Sunita! Tell me about the machines you've worked on.", timestamp: "" },
      { speaker: "worker", text: "I have worked on flatbed machine and overlock for 2 years.", timestamp: "" },
      { speaker: "ai",     text: "How do you attach a zipper to denim? Walk me through the steps.", timestamp: "" },
      { speaker: "worker", text: "First I pin the zipper, then sew on both sides... I sometimes use tape to hold it.", timestamp: "" },
      { speaker: "ai",     text: "What seam allowance do you maintain for denim?", timestamp: "" },
      { speaker: "worker", text: "I think around 1 cm, but it depends on the master's instruction.", timestamp: "" },
    ],
  },
  {
    id: "demo_003",
    worker_name: "Mohan Lal",
    assignment: "Identify defects in a batch of 20 finished kurtas",
    live_score: 38,
    recommendation: "reject",
    summary: "Mohan was unable to name common fabric defects beyond broken stitches. He had no knowledge of skip stitch or seam puckering causes. Confidence was low and responses were vague. Not suitable for quality control role at this time.",
    rubric_scores: {
      stitch_quality: 35,
      machine_familiarity: 40,
      technical_knowledge: 30,
      fabric_material_knowledge: 42,
      communication_confidence: 38,
    },
    integrity_log: {
      overall_flag: "requires_review",
      multiface_events: 2,
      face_absent_events: 3,
      gaze_deviation_events: 5,
    },
    interview_mode: "whatsapp",
    transcript: [
      { speaker: "ai",     text: "Mohan ji, kurte mein kya defects dhundhte hain aap?", timestamp: "" },
      { speaker: "worker", text: "Dhaga toot jaye toh defect hota hai.", timestamp: "" },
      { speaker: "ai",     text: "Aur koi defect types jaante hain — jaise puckering ya skip stitch?", timestamp: "" },
      { speaker: "worker", text: "Nahi, ye nahi pata mujhe.", timestamp: "" },
      { speaker: "ai",     text: "Theek hai. Agar seam crooked ho toh kya karenge?", timestamp: "" },
      { speaker: "worker", text: "Master ko dikhaunga.", timestamp: "" },
    ],
  },
];

const DUMMY_LIVE = [
  {
    id: "live_demo_001",
    worker_name: "Priya Sharma",
    assignment: "Sew sleeve placket on a cotton shirt",
    live_score: 74,
    interview_mode: "call",
    transcript: [
      { speaker: "ai",     text: "Priya ji, placket lagane ke liye aap kaunsa stitch use karti hain?", timestamp: "" },
      { speaker: "worker", text: "Main lockstitch use karti hoon aur corners pe backtrack karti hoon.", timestamp: "" },
    ],
  },
];

// ── Rubric metadata ──────────────────────────────────────────────────────────
const RUBRIC_KEYS = [
  { key: "stitch_quality",          weight: 0.32, label: "Stitch Quality",          labelHi: "सिलाई गुणवत्ता" },
  { key: "machine_familiarity",     weight: 0.26, label: "Machine Familiarity",     labelHi: "मशीन परिचय" },
  { key: "technical_knowledge",     weight: 0.24, label: "Technical Knowledge",     labelHi: "तकनीकी ज्ञान" },
  { key: "fabric_material_knowledge", weight: 0.12, label: "Fabric & Material",    labelHi: "कपड़ा ज्ञान" },
  { key: "communication_confidence", weight: 0.06, label: "Communication",          labelHi: "संवाद कौशल" },
];

function rubricColor(score) {
  if (score >= 75) return "#16a34a"; // green
  if (score >= 50) return "#d97706"; // amber
  return "#dc2626";                  // red
}


const RECOMMENDATION_STYLE = {
  pass:    "bg-green-100 text-green-700 border-green-300",
  hold:    "bg-yellow-100 text-yellow-700 border-yellow-300",
  reject:  "bg-red-100 text-red-700 border-red-300",
  pending: "bg-slate-100 text-slate-600 border-slate-300",
};

const CHANNEL_LABEL = {
  web: "Web",
  call: "Call",
  whatsapp: "WhatsApp",
  offline: "Offline",
};

// ── Copy map ─────────────────────────────────────────────────────────────────
const C = {
  en: {
    kicker: "command center",
    title: "Screening Operations Dashboard",
    desc: "Monitor live worker screenings, review AI analysis, and make final hiring decisions.",
    metrics: {
      workers:  ["Total Workers",   "registered profiles"],
      active:   ["Active Sessions", "live right now"],
      passRate: ["Pass Rate",       "completed reports"],
      rejected: ["Rejected",        "final decisions"],
    },
    live: {
      title: "Live Sessions",
      empty: "No active screenings right now.",
      noTurn: "Awaiting first response…",
      score: "live score",
      assignment: "Assignment",
    },
    reports: {
      title: "Completed Reports",
      empty: "No completed reports yet.",
      score: "Final Score",
      integrity: "Integrity",
      aiRec: "AI Recommendation",
      humanDecision: "Human Decision",
      rubric: "Rubric Breakdown",
      weight: "weight",
      analysis: "AI Analysis",
      transcript: "Full Transcript",
      showTranscript: "Show transcript",
      hideTranscript: "Hide transcript",
      pass: "PASS",
      hold: "HOLD",
      reject: "REJECT",
      overrideLabel: "Override decision:",
      flags: { clear: "clear", minor_warning: "minor warning", requires_review: "requires review", critical_flag: "critical" },
      multiface: "Multi-face",
      absent: "Absent",
      gaze: "Gaze",
    },
  },
  hi: {
    kicker: "कमांड सेंटर",
    title: "स्क्रीनिंग ऑपरेशन्स डैशबोर्ड",
    desc: "लाइव स्क्रीनिंग मॉनिटर करें, AI विश्लेषण देखें, और अंतिम निर्णय लें।",
    metrics: {
      workers:  ["कुल Worker",    "रजिस्टर्ड प्रोफाइल"],
      active:   ["सक्रिय Session", "अभी लाइव"],
      passRate: ["पास रेट",       "पूर्ण Report"],
      rejected: ["रिजेक्टेड",    "अंतिम निर्णय"],
    },
    live: {
      title: "लाइव Session",
      empty: "इस समय कोई active screening नहीं है।",
      noTurn: "पहले जवाब का इंतजार…",
      score: "लाइव स्कोर",
      assignment: "असाइनमेंट",
    },
    reports: {
      title: "पूर्ण Reports",
      empty: "अभी कोई पूर्ण report नहीं है।",
      score: "अंतिम स्कोर",
      integrity: "इंटीग्रिटी",
      aiRec: "AI सिफारिश",
      humanDecision: "मानव निर्णय",
      rubric: "Rubric विश्लेषण",
      weight: "भार",
      analysis: "AI विश्लेषण",
      transcript: "पूर्ण Transcript",
      showTranscript: "Transcript देखें",
      hideTranscript: "Transcript छुपाएं",
      pass: "पास",
      hold: "होल्ड",
      reject: "रिजेक्ट",
      overrideLabel: "Override करें:",
      flags: { clear: "सामान्य", minor_warning: "मामूली चेतावनी", requires_review: "समीक्षा जरूरी", critical_flag: "गंभीर" },
      multiface: "मल्टी-फेस",
      absent: "अनुपस्थित",
      gaze: "दृष्टि",
    },
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ title, value, subtitle, icon: Icon, testId }) {
  return (
    <Card className="border-border/60" data-testid={testId}>
      <CardHeader className="pb-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-4xl text-primary">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RubricBar({ label, labelHi, score, weight, locale, weightLabel }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = rubricColor(pct);
  const displayLabel = locale === "hi" ? labelHi : label;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{displayLabel}</span>
        <span className="font-mono text-muted-foreground">
          {Math.round(pct)}% &nbsp;<span className="text-[10px] opacity-60">({Math.round(weight * 100)}% {weightLabel})</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ChannelBadge({ mode }) {
  const label = CHANNEL_LABEL[mode] || CHANNEL_LABEL.web;
  return <Badge variant="outline" className="border-border/60 text-foreground">{label}</Badge>;
}

function IntegrityBadge({ log, copy }) {
  if (!log) return null;
  const flag = log.overall_flag || "clear";
  const flagStyles = {
    clear:          "bg-green-50 border-green-300 text-green-700",
    minor_warning:  "bg-yellow-50 border-yellow-300 text-yellow-700",
    requires_review:"bg-orange-50 border-orange-300 text-orange-700",
    critical_flag:  "bg-red-50 border-red-300 text-red-700",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${flagStyles[flag] || flagStyles.clear}`}>
      <p className="font-semibold uppercase tracking-wide">{copy.flags[flag] || flag}</p>
      <p className="mt-0.5 font-mono opacity-80">
        {copy.multiface}: {log.multiface_events ?? 0} &nbsp;|&nbsp;
        {copy.absent}: {log.face_absent_events ?? 0} &nbsp;|&nbsp;
        {copy.gaze}: {log.gaze_deviation_events ?? 0}
      </p>
    </div>
  );
}

function TranscriptViewer({ transcript, showLabel, hideLabel }) {
  const [open, setOpen] = useState(false);
  if (!transcript?.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? hideLabel : showLabel} ({transcript.length})
      </button>
      {open && (
        <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
          {transcript.map((item, i) => (
            <div
              key={i}
              className={`flex gap-2 text-xs ${item.speaker === "ai" ? "text-accent" : item.speaker === "worker" ? "text-foreground" : "text-muted-foreground italic"}`}
            >
              <span className="w-12 shrink-0 font-mono font-semibold uppercase opacity-70">{item.speaker}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HumanOverride({ sessionId, current, onOverride, copy }) {
  const buttons = [
    { key: "pass",   label: copy.pass,   bg: "#dcfce7", border: "#16a34a", text: "#15803d", activeBg: "#16a34a", activeText: "#fff" },
    { key: "hold",   label: copy.hold,   bg: "#fef9c3", border: "#ca8a04", text: "#92400e", activeBg: "#ca8a04", activeText: "#fff" },
    { key: "reject", label: copy.reject, bg: "#fee2e2", border: "#dc2626", text: "#991b1b", activeBg: "#dc2626", activeText: "#fff" },
  ];
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{copy.overrideLabel}</p>
      <div className="flex gap-2">
        {buttons.map(({ key, label, bg, border, text, activeBg, activeText }) => {
          const active = current === key;
          return (
            <button
              key={key}
              onClick={() => onOverride(sessionId, active ? null : key)}
              style={{
                background: active ? activeBg : bg,
                borderColor: border,
                color: active ? activeText : text,
                border: `1.5px solid`,
                borderRadius: "8px",
                padding: "4px 14px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportCard({ report, override, onOverride, locale, copy }) {
  const [expanded, setExpanded] = useState(false);
  const rubricScores = report.rubric_scores || {};
  const effectiveRec = override || report.recommendation || "pending";
  const recStyle = RECOMMENDATION_STYLE[effectiveRec] || RECOMMENDATION_STYLE.pending;

  return (
    <article
      className="rounded-xl border border-border/60 bg-background"
      data-testid={`report-card-${report.id}`}
    >
      {/* ── Header row ── */}
      <div
        className="flex cursor-pointer items-center justify-between gap-3 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-primary">{report.worker_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-accent">{copy.score}: {Math.round(report.live_score ?? 0)}%</p>
            <ChannelBadge mode={report.interview_mode} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={`border text-[11px] ${recStyle}`}>
            {effectiveRec.toUpperCase()}
            {override && <span className="ml-1 opacity-60">(human)</span>}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="space-y-5 border-t border-border/60 px-4 pb-5 pt-4">

          {/* Rubric scorecard */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.rubric}</p>
            <div className="space-y-3">
              {RUBRIC_KEYS.map(({ key, weight, label, labelHi }) => (
                <RubricBar
                  key={key}
                  label={label}
                  labelHi={labelHi}
                  score={rubricScores[key] ?? 0}
                  weight={weight}
                  locale={locale}
                  weightLabel={copy.weight}
                />
              ))}
            </div>
          </div>

          {/* Integrity */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.integrity}</p>
            <IntegrityBadge log={report.integrity_log} copy={copy} />
          </div>

          {/* Session recording placeholder */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session Recording</p>
            <div
              style={{
                width: "100%", height: 160,
                background: "#0a0a0a",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 8,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em" }}>
                Recording will be available soon
              </p>
            </div>
          </div>

          {/* AI analysis */}
          {report.summary && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.analysis}</p>
              <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-foreground leading-relaxed">
                {report.summary}
              </p>
            </div>
          )}

          {/* Transcript */}
          <TranscriptViewer
            transcript={report.transcript}
            showLabel={copy.showTranscript}
            hideLabel={copy.hideTranscript}
          />

          {/* Human override */}
          <HumanOverride
            sessionId={report.id}
            current={override || null}
            onOverride={onOverride}
            copy={copy}
          />
        </div>
      )}
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { locale } = useLanguage();
  const copy = C[locale] ?? C.en;

  const [liveSessions, setLiveSessions] = useState([]);
  const [reports, setReports]           = useState([]);
  const [workers, setWorkers]           = useState([]);
  const [overrides, setOverrides]       = useState({}); // { sessionId: "pass"|"hold"|"reject"|null }

  useEffect(() => {
    const fetch = async () => {
      try {
        const [live, reps, wrks] = await Promise.all([
          screeningApi.listLiveSessions(),
          screeningApi.listReports(),
          screeningApi.listWorkers(),
        ]);
        setLiveSessions(live.length ? live : DUMMY_LIVE);
        setReports(reps.length ? reps : DUMMY_REPORTS);
        setWorkers(wrks);
      } catch { /* keep stale data */ }
    };
    fetch();
    const id = setInterval(fetch, 8000);
    return () => clearInterval(id);
  }, []);

  const handleOverride = (sessionId, decision) => {
    setOverrides((prev) => ({ ...prev, [sessionId]: decision }));
  };

  const stats = useMemo(() => {
    const effective = reports.map((r) => overrides[r.id] ?? r.recommendation);
    const passCount   = effective.filter((r) => r === "pass").length;
    const rejectCount = effective.filter((r) => r === "reject").length;
    const passRate    = reports.length ? Math.round((passCount / reports.length) * 100) : 0;
    return { workers: workers.length || 4, active: liveSessions.length, passRate, rejected: rejectCount };
  }, [liveSessions, reports, workers, overrides]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10" data-testid="admin-dashboard-page">
      {/* Header */}
      <section className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{copy.kicker}</p>
        <h1 className="font-heading text-4xl text-primary md:text-5xl">{copy.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{copy.desc}</p>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title={copy.metrics.workers[0]}  value={stats.workers}          subtitle={copy.metrics.workers[1]}  icon={Users}         testId="metric-total-workers" />
        <MetricCard title={copy.metrics.active[0]}   value={stats.active}           subtitle={copy.metrics.active[1]}   icon={Activity}      testId="metric-active-sessions" />
        <MetricCard title={copy.metrics.passRate[0]} value={`${stats.passRate}%`}   subtitle={copy.metrics.passRate[1]} icon={CheckCircle2}  testId="metric-pass-rate" />
        <MetricCard title={copy.metrics.rejected[0]} value={stats.rejected}         subtitle={copy.metrics.rejected[1]} icon={XCircle}       testId="metric-rejected-count" />
      </section>

      {/* Live + Reports */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Live sessions */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-primary">{copy.live.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.live.empty}</p>
            ) : (
              liveSessions.map((s) => {
                const lastTurn = s.transcript?.[s.transcript.length - 1]?.text || copy.live.noTurn;
                return (
                  <article key={s.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-primary">{s.worker_name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <ChannelBadge mode={s.interview_mode} />
                        <Badge className="bg-accent/10 text-accent">
                          {Math.round(s.live_score ?? 0)}% {copy.live.score}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
                      {copy.live.assignment}: {s.assignment}
                    </p>
                    <p className="mt-2 rounded-lg border border-border/60 bg-background p-2 text-sm line-clamp-2">
                      {lastTurn}
                    </p>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Completed reports */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-primary">{copy.reports.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.reports.empty}</p>
              ) : (
                reports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    override={overrides[report.id] ?? null}
                    onOverride={handleOverride}
                    locale={locale}
                    copy={copy.reports}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
