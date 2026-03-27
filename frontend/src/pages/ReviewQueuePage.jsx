import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/language";
import { screeningApi } from "@/services/api";

const CHANNEL_LABELS = {
  web:       { label: "Web App",   color: "#3b82f6" },
  whatsapp:  { label: "WhatsApp",  color: "#22c55e" },
  ivr_call:  { label: "IVR Call",  color: "#f59e0b" },
  call:      { label: "IVR Call",  color: "#f59e0b" },
  offline:   { label: "Offline",   color: "#8b5cf6" },
};

const REC_COLORS = {
  pass:    { bg: "rgba(34,197,94,0.1)",  text: "#16a34a", label: "Pass" },
  hold:    { bg: "rgba(245,158,11,0.1)", text: "#d97706", label: "Hold" },
  reject:  { bg: "rgba(239,68,68,0.1)",  text: "#dc2626", label: "Reject" },
  pending: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Pending" },
};

const INT_COLORS = {
  clear:           { color: "#22c55e", label: "Clear" },
  minor_warning:   { color: "#f59e0b", label: "Minor Warning" },
  requires_review: { color: "#f97316", label: "Requires Review" },
  critical_flag:   { color: "#ef4444", label: "Critical Flag" },
};

const copyMap = {
  en: {
    title: "Human Review Queue",
    subtitle: "Sessions routed for manual assessment — next-day SLA",
    confidence: "Confidence",
    score: "Score",
    weak: "Weak signal",
    channel: "Channel",
    aiRec: "AI says",
    review: "Review →",
    approve: "Approve Scores",
    requestReinterview: "Request Re-interview",
    noQueue: "Review queue is empty — all sessions auto-forwarded.",
    reviewTitle: "Reviewing",
    close: "Close",
    pending: "Pending Review",
    transcript: "Transcript",
    rubricScores: "Rubric Scores",
    selfRatings: "Self Ratings",
    editRubric: "Edit Score",
    saveChanges: "Save Changes",
    saving: "Saving...",
    saved: "Saved",
    aiAssessment: "AI Assessment",
    integrity: "Integrity",
    decision: "Decision",
    override: "Override recommendation",
    approved: "Scores approved",
    reinterviewRequested: "Re-interview requested",
    noTranscript: "No transcript available.",
    editNote: "Reason for edit (required)",
    editNotePlaceholder: "e.g. Worker described process correctly but AI missed context",
    timeSpent: "Time on review",
    submitDecision: "Submit Decision",
  },
  hi: {
    title: "Human Review Queue",
    subtitle: "Manual assessment ke liye routed sessions — next-day SLA",
    confidence: "Confidence",
    score: "Score",
    weak: "Weak signal",
    channel: "Channel",
    aiRec: "AI ka sujhaav",
    review: "Review karein →",
    approve: "Scores approve karein",
    requestReinterview: "Re-interview maangein",
    noQueue: "Review queue khaali hai — sab sessions auto-forward ho gaye.",
    reviewTitle: "Review ho raha hai",
    close: "Bandh karein",
    pending: "Review baaki hai",
    transcript: "Transcript",
    rubricScores: "Rubric Scores",
    selfRatings: "Self Ratings",
    editRubric: "Score edit karein",
    saveChanges: "Badlaav save karein",
    saving: "Save ho raha hai...",
    saved: "Save ho gaya",
    aiAssessment: "AI Mulyaankan",
    integrity: "Integrity",
    decision: "Nirnay",
    override: "Recommendation badlein",
    approved: "Scores approve ho gaye",
    reinterviewRequested: "Re-interview maanga gaya",
    noTranscript: "Koi transcript nahi mila.",
    editNote: "Edit ka kaaran (zaruri)",
    editNotePlaceholder: "e.g. Worker ne sahi bataya lekin AI context chook gayi",
    timeSpent: "Review mein laga waqt",
    submitDecision: "Nirnay submit karein",
  },
};

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.75 ? "#22c55e" : value >= 0.55 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function RubricBar({ label, aiScore, selfScore, editable, editedScore, onEdit }) {
  const val = editable && editedScore !== undefined ? editedScore : Math.round(aiScore ?? 0);
  const barColor = val >= 70 ? "#22c55e" : val >= 45 ? "#f59e0b" : "#ef4444";
  const selfVal = selfScore != null ? Math.round(selfScore) : null;
  const mismatch = selfVal != null && Math.abs(selfVal - val) > 20;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#23314f", fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selfVal != null && (
            <span style={{ fontSize: 10, color: mismatch ? "#f97316" : "#64748b" }}>
              Self: {selfVal}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{val}</span>
          {editable && (
            <button
              onClick={() => onEdit(label, val)}
              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, border: "1px solid #dbe4f0", background: "none", color: "#64748b", cursor: "pointer" }}
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(35,49,79,0.06)" }}>
        <div style={{ height: "100%", borderRadius: 3, background: barColor, width: `${val}%`, transition: "width 0.8s ease" }} />
      </div>
      {editable && editedScore !== undefined && editedScore !== Math.round(aiScore ?? 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
          <input
            type="range" min={0} max={100} value={editedScore}
            onChange={(e) => onEdit(label, Number(e.target.value), true)}
            style={{ flex: 1, accentColor: "#3b82f6" }}
          />
        </div>
      )}
    </div>
  );
}

function ReviewModal({ session, onClose, copy, onDecisionSaved }) {
  const [tab, setTab] = useState("overview");
  const [editedRubrics, setEditedRubrics] = useState({});
  const [editNotes, setEditNotes] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [overrideRec, setOverrideRec] = useState(session?.aiRecommendation ?? "hold");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [startTime] = useState(Date.now());

  if (!session) return null;

  const ch = CHANNEL_LABELS[session.channel] ?? CHANNEL_LABELS.web;
  const rec = REC_COLORS[session.aiRecommendation] ?? REC_COLORS.hold;
  const intFl = INT_COLORS[session.integrityFlag] ?? INT_COLORS.clear;
  const rubrics = session.rubricScores ?? {};
  const selfRatings = session.selfRatings ?? {};
  const transcript = session.transcript ?? [];


  const handleSave = async () => {
    setSaving(true);
    try {
      await screeningApi.submitReviewDecision(session.id, {
        reviewer_id: "admin",
        final_recommendation: overrideRec,
        rubric_edits: editedRubrics,
        edit_notes: editNotes,
        time_spent_seconds: Math.round((Date.now() - startTime) / 1000),
      });
      setSaved(true);
      setTimeout(() => {
        onDecisionSaved?.();
        onClose();
      }, 1200);
    } catch {
      setSaving(false);
    }
  };

  const RUBRIC_LABELS_MAP = {
    stitch_quality: "Stitch Quality",
    machine_familiarity: "Machine Familiarity",
    technical_knowledge: "Technical Knowledge",
    fabric_material_knowledge: "Fabric Knowledge",
    communication_confidence: "Communication",
    work_output_quality: "Output Quality",
    technique_process_knowledge: "Process",
    tool_product_knowledge: "Tools",
    integrity_compliance: null,
  };

  const rubricEntries = Object.entries(rubrics).filter(([k]) => RUBRIC_LABELS_MAP[k] !== null);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl md:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#3b82f6", margin: "0 0 4px" }}>{copy.reviewTitle}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, margin: 0, color: "#23314f" }}>{session.workerName}</h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>{session.trade}</p>
            </div>
            <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 22, color: "#64748b", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { label: copy.score, value: `${session.overallScore}/100` },
              { label: copy.confidence, value: `${Math.round(session.confidence * 100)}%`, color: session.confidence < 0.55 ? "#ef4444" : session.confidence < 0.80 ? "#f59e0b" : "#22c55e" },
              { label: copy.channel, value: ch.label, color: ch.color, bg: `${ch.color}12` },
              { label: copy.aiRec, value: rec.label, color: rec.text, bg: rec.bg },
              { label: copy.integrity, value: intFl.label, color: intFl.color, bg: `${intFl.color}12` },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ padding: "8px 12px", borderRadius: 10, background: bg ?? "rgba(35,49,79,0.04)", minWidth: 80 }}>
                <p style={{ margin: 0, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>{label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, color: color ?? "#23314f" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Weak signal */}
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#d97706" }}>{copy.weak}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#92400e" }}>{session.weakComponent}</p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #dbe4f0" }}>
            {[
              { key: "overview", label: copy.rubricScores },
              { key: "transcript", label: copy.transcript },
              { key: "decision", label: copy.decision },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: tab === t.key ? "#23314f" : "#94a3b8",
                  borderBottom: `2px solid ${tab === t.key ? "#3b82f6" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", padding: "16px 24px 24px", flex: 1 }}>

          {/* Rubric scores tab */}
          {tab === "overview" && (
            <div>
              {rubricEntries.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 13 }}>No rubric scores available.</p>
              ) : (
                rubricEntries.map(([key, val]) => {
                  const label = RUBRIC_LABELS_MAP[key] ?? key.replace(/_/g, " ");
                  return (
                    <RubricBar
                      key={key}
                      label={label}
                      aiScore={val}
                      selfScore={selfRatings[key]}
                      editable
                      editedScore={editedRubrics[key]}
                      onEdit={(_lbl, newVal, isSlider) => {
                        setEditedRubrics((p) => ({ ...p, [key]: newVal }));
                        if (!isSlider) setEditingKey(key);
                      }}
                    />
                  );
                })
              )}
              {editingKey && (
                <div style={{ marginTop: 16, padding: "14px", borderRadius: 12, border: "1px solid #dbe4f0", background: "#f8fafc" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#23314f", display: "block", marginBottom: 6 }}>{copy.editNote}</label>
                  <input
                    placeholder={copy.editNotePlaceholder}
                    value={editNotes[editingKey] ?? ""}
                    onChange={(e) => setEditNotes((p) => ({ ...p, [editingKey]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #dbe4f0", borderRadius: 8, fontSize: 13, fontFamily: "Manrope, sans-serif", boxSizing: "border-box" }}
                  />
                  <button onClick={() => setEditingKey(null)} style={{ marginTop: 8, fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}>Done</button>
                </div>
              )}

              {/* AI summary */}
              {session.summary && (
                <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 12, background: "rgba(59,130,246,0.05)", borderLeft: "3px solid #3b82f6" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#3b82f6", margin: "0 0 6px" }}>{copy.aiAssessment}</p>
                  <p style={{ fontSize: 12, color: "#23314f", lineHeight: 1.7, margin: 0 }}>{session.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Transcript tab */}
          {tab === "transcript" && (
            <div>
              {transcript.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 13 }}>{copy.noTranscript}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {transcript.map((item, i) => {
                    const isAI = item.speaker === "ai";
                    const isSystem = item.speaker === "system";
                    return (
                      <div
                        key={i}
                        style={{
                          alignSelf: isAI ? "flex-start" : isSystem ? "center" : "flex-end",
                          maxWidth: isSystem ? "100%" : "85%",
                        }}
                      >
                        {isSystem ? (
                          <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 11, color: "#d97706", textAlign: "center" }}>
                            {item.text}
                          </div>
                        ) : (
                          <div>
                            <p style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 3px", textAlign: isAI ? "left" : "right" }}>
                              {isAI ? "AI" : "Worker"}
                              {item.rubric_tag && <span style={{ marginLeft: 6, color: "#3b82f6" }}>#{item.rubric_tag}</span>}
                              {item.acoustic_confidence != null && (
                                <span style={{ marginLeft: 6, color: item.acoustic_confidence > 0.8 ? "#22c55e" : "#f59e0b" }}>
                                  {Math.round(item.acoustic_confidence * 100)}%
                                </span>
                              )}
                            </p>
                            <div style={{
                              padding: "10px 14px", borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                              background: isAI ? "#f1f5f9" : "#23314f",
                              color: isAI ? "#23314f" : "#fff",
                              fontSize: 13, lineHeight: 1.6,
                            }}>
                              {item.text}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Decision tab */}
          {tab === "decision" && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#23314f", marginBottom: 10 }}>{copy.override}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {["pass", "hold", "reject"].map((r) => {
                  const c = REC_COLORS[r];
                  const active = overrideRec === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setOverrideRec(r)}
                      style={{
                        padding: "10px 20px", borderRadius: 999, border: `2px solid ${active ? c.text : "#dbe4f0"}`,
                        background: active ? c.bg : "none", color: active ? c.text : "#64748b",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {saved ? (
                <div style={{ textAlign: "center", padding: "14px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: "#16a34a", margin: 0 }}>{copy.saved}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "13px", borderRadius: 999, border: "none",
                      background: saving ? "#94a3b8" : "#23314f",
                      color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? copy.saving : copy.submitDecision}
                  </button>
                  <button
                    onClick={() => {
                      screeningApi.submitReviewDecision(session.id, {
                        reviewer_id: "admin",
                        final_recommendation: "hold",
                        rubric_edits: {},
                        edit_notes: { reinterview: "Requested re-interview" },
                        time_spent_seconds: Math.round((Date.now() - startTime) / 1000),
                      }).then(() => { onDecisionSaved?.(); onClose(); }).catch(() => {});
                    }}
                    style={{ padding: "13px", borderRadius: 999, border: "1px solid #dbe4f0", background: "none", color: "#23314f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    {copy.requestReinterview}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */
export default function ReviewQueuePage() {
  const { locale } = useLanguage();
  const copy = copyMap[locale] ?? copyMap.en;
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchQueue = () => {
    setLoading(true);
    screeningApi.getReviewQueue()
      .then((data) => setQueue(data ?? []))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQueue(); }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 md:px-10 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#3b82f6", margin: "0 0 6px" }}>
          {copy.pending}
        </p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#23314f", margin: 0 }}>
          {copy.title}
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>{copy.subtitle}</p>
      </div>

      {/* Queue */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 14 }}>
          Loading…
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-slate-200 bg-white">
          <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: "#23314f" }}>{copy.noQueue}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((session) => {
            const ch = CHANNEL_LABELS[session.channel] ?? CHANNEL_LABELS.web;
            const rec = REC_COLORS[session.aiRecommendation] ?? REC_COLORS.hold;
            const intFl = INT_COLORS[session.integrityFlag] ?? INT_COLORS.clear;
            return (
              <article
                key={session.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 flex flex-col gap-4"
                style={{ boxShadow: "0 8px 24px rgba(35,49,79,0.05)" }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: "#23314f", margin: 0 }}>{session.workerName}</h3>
                    <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0", maxWidth: 320 }}>{session.trade}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: `${ch.color}18`, color: ch.color }}>
                      {ch.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: rec.bg, color: rec.text }}>
                      {rec.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: `${intFl.color}12`, color: intFl.color }}>
                      {intFl.label}
                    </span>
                  </div>
                </div>

                {/* Score + Confidence */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 60 }}>
                    <p style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 3px" }}>{copy.score}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#23314f", margin: 0 }}>{session.overallScore}<span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>/100</span></p>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <p style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>{copy.confidence}</p>
                    <ConfidenceBar value={session.confidence} />
                  </div>
                </div>

                {/* Weak signal */}
                <p style={{ fontSize: 13, color: "#92400e", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "8px 12px", margin: 0 }}>
                  ⚠ {session.weakComponent}
                </p>

                {/* Action */}
                <button
                  onClick={() => setSelected(session)}
                  className="self-end px-5 py-2.5 rounded-full text-sm font-bold text-white"
                  style={{ background: "#23314f", border: "none", cursor: "pointer", minHeight: 44 }}
                >
                  {copy.review}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <ReviewModal
        session={selected}
        onClose={() => setSelected(null)}
        copy={copy}
        onDecisionSaved={fetchQueue}
      />
    </main>
  );
}
