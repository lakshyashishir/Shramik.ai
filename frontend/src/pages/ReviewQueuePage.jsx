import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/language";
import { useT } from "@/i18n/language";

const MOCK_QUEUE = [
  {
    id: "sess_001",
    workerName: "Arvind Sharma",
    trade: "Tailor",
    channel: "web",
    confidence: 0.61,
    overallScore: 58,
    weakComponent: "Evidence Quality low — no photo uploaded",
    aiRecommendation: "hold",
    submittedAt: "2026-03-24T08:14:00Z",
  },
  {
    id: "sess_002",
    workerName: "Meena Devi",
    trade: "Garment Worker",
    channel: "whatsapp",
    confidence: 0.57,
    overallScore: 52,
    weakComponent: "Self-rating vs AI score mismatch > 2 bands",
    aiRecommendation: "hold",
    submittedAt: "2026-03-24T07:42:00Z",
  },
  {
    id: "sess_003",
    workerName: "Raju Prasad",
    trade: "Tailor",
    channel: "ivr_call",
    confidence: 0.49,
    overallScore: 44,
    weakComponent: "Low acoustic confidence — telephony noise",
    aiRecommendation: "reject",
    submittedAt: "2026-03-23T21:05:00Z",
  },
];

const CHANNEL_LABELS = {
  web:       { label: "Web App",   color: "#3b82f6" },
  whatsapp:  { label: "WhatsApp",  color: "#22c55e" },
  ivr_call:  { label: "IVR Call",  color: "#f59e0b" },
  offline:   { label: "Offline",   color: "#8b5cf6" },
};

const REC_COLORS = {
  pass:   { bg: "rgba(34,197,94,0.1)",  text: "#16a34a", label: "Pass" },
  hold:   { bg: "rgba(245,158,11,0.1)", text: "#d97706", label: "Hold" },
  reject: { bg: "rgba(239,68,68,0.1)",  text: "#dc2626", label: "Reject" },
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

function ReviewModal({ session, onClose, copy }) {
  const [decision, setDecision] = useState(null);
  if (!session) return null;
  const ch = CHANNEL_LABELS[session.channel] ?? CHANNEL_LABELS.web;
  const rec = REC_COLORS[session.aiRecommendation] ?? REC_COLORS.hold;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh", padding: "clamp(20px,4vw,32px)" }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#3b82f6", margin: 0 }}>{copy.reviewTitle}</p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, margin: "4px 0 0", color: "#23314f" }}>{session.workerName}</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{session.trade}</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 22, color: "#64748b", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: copy.score,      value: `${session.overallScore}/100` },
            { label: copy.confidence, value: `${Math.round(session.confidence * 100)}%` },
            { label: copy.channel,    value: ch.label,           color: ch.color },
            { label: copy.aiRec,      value: rec.label,          color: rec.text, bg: rec.bg },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg ?? "rgba(35,49,79,0.04)", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#94a3b8" }}>{label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: color ?? "#23314f" }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#d97706" }}>{copy.weak}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#92400e" }}>{session.weakComponent}</p>
        </div>

        {!decision ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setDecision("approved")}
              className="w-full py-3 rounded-full font-bold text-sm text-white"
              style={{ background: "#22c55e", border: "none", cursor: "pointer" }}
            >
              {copy.approve}
            </button>
            <button
              onClick={() => setDecision("reinterview")}
              className="w-full py-3 rounded-full font-bold text-sm"
              style={{ background: "rgba(35,49,79,0.06)", border: "1px solid rgba(35,49,79,0.12)", color: "#23314f", cursor: "pointer" }}
            >
              {copy.requestReinterview}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 20, margin: 0 }}>{decision === "approved" ? "✅" : "🔄"}</p>
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: "#23314f", margin: "8px 0 4px" }}>
              {decision === "approved" ? "Scores approved" : "Re-interview requested"}
            </p>
            <button onClick={onClose} style={{ marginTop: 12, padding: "10px 24px", borderRadius: 999, border: "none", background: "#23314f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{copy.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const { locale } = useLanguage();
  const copy = copyMap[locale] ?? copyMap.en;
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [selected, setSelected] = useState(null);

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
      {queue.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-slate-200 bg-white">
          <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: "#23314f" }}>{copy.noQueue}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((session) => {
            const ch = CHANNEL_LABELS[session.channel] ?? CHANNEL_LABELS.web;
            const rec = REC_COLORS[session.aiRecommendation] ?? REC_COLORS.hold;
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
                    <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>{session.trade}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: `${ch.color}18`, color: ch.color }}>
                      {ch.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: rec.bg, color: rec.text }}>
                      {rec.label}
                    </span>
                  </div>
                </div>

                {/* Confidence bar */}
                <div>
                  <p style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>{copy.confidence}</p>
                  <ConfidenceBar value={session.confidence} />
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

      <ReviewModal session={selected} onClose={() => setSelected(null)} copy={copy} />
    </main>
  );
}
