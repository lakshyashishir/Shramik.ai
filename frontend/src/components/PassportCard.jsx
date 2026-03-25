import { useEffect, useRef, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/i18n/language";

/* ─── Tier config ────────────────────────────────────────────── */
const TIERS = [
  { key: "bronze",   label: "Bronze",   labelHi: "कांस्य",    min: 0,  color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.4)" },
  { key: "silver",   label: "Silver",   labelHi: "रजत",       min: 41, color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.4)" },
  { key: "gold",     label: "Gold",     labelHi: "स्वर्ण",    min: 66, color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.4)" },
  { key: "platinum", label: "Platinum", labelHi: "प्लेटिनम", min: 81, color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)" },
];

function getTier(score) {
  if (score >= 81) return TIERS[3];
  if (score >= 66) return TIERS[2];
  if (score >= 41) return TIERS[1];
  return TIERS[0];
}

/* ─── Integrity badge config ─────────────────────────────────── */
const INTEGRITY = {
  clear:            { label: "Clear",           labelHi: "स्वच्छ",           color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  minor_warning:    { label: "Minor Warning",   labelHi: "हल्की चेतावनी",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  requires_review:  { label: "Requires Review", labelHi: "समीक्षा आवश्यक",  color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  critical_flag:    { label: "Critical Flag",   labelHi: "गंभीर चिह्न",     color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const RUBRIC_LABELS = {
  en: {
    stitch_quality:            "Stitch",
    machine_familiarity:       "Machine",
    technical_knowledge:       "Technical",
    fabric_material_knowledge: "Fabric",
    communication_confidence:  "Comms",
    work_output_quality:       "Output",
    technique_process_knowledge: "Process",
    tool_product_knowledge:    "Tools",
    client_assessment:         "Client",
    joint_assembly_quality:    "Joint",
    tool_handling:             "Tools",
    material_knowledge:        "Material",
    measurement_precision:     "Precision",
    safety_protocol:           "Safety",
    circuit_load_knowledge:    "Circuit",
    circuit_diagram_quality:   "Diagram",
    tool_instrument_knowledge: "Instruments",
  },
  hi: {
    stitch_quality:            "सिलाई",
    machine_familiarity:       "मशीन",
    technical_knowledge:       "तकनीक",
    fabric_material_knowledge: "कपड़ा",
    communication_confidence:  "संवाद",
    work_output_quality:       "गुणवत्ता",
    technique_process_knowledge: "प्रक्रिया",
    tool_product_knowledge:    "टूल्स",
    client_assessment:         "क्लाइंट",
    joint_assembly_quality:    "जोड़",
    tool_handling:             "औज़ार",
    material_knowledge:        "सामग्री",
    measurement_precision:     "नाप-तोल",
    safety_protocol:           "सुरक्षा",
    circuit_load_knowledge:    "सर्किट",
    circuit_diagram_quality:   "डायग्राम",
    tool_instrument_knowledge: "उपकरण",
  },
};

const RUBRIC_GROUPS = [
  ["stitch_quality", "machine_familiarity", "technical_knowledge", "fabric_material_knowledge", "communication_confidence"],
  ["work_output_quality", "technique_process_knowledge", "tool_product_knowledge", "client_assessment", "communication_confidence"],
  ["joint_assembly_quality", "tool_handling", "material_knowledge", "measurement_precision", "communication_confidence"],
  ["safety_protocol", "circuit_load_knowledge", "circuit_diagram_quality", "tool_instrument_knowledge", "communication_confidence"],
];

function resolveRubricOrder(rubricScores) {
  const keys = Object.keys(rubricScores || {}).filter((k) => k !== "integrity_compliance");
  for (const group of RUBRIC_GROUPS) {
    if (group.every((k) => keys.includes(k))) return group;
  }
  return keys.length ? keys : RUBRIC_GROUPS[0];
}

/* ─── Karma ring (SVG) ───────────────────────────────────────── */
function KarmaRing({ karma, color }) {
  const radius = 52;
  const stroke = 7;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(karma), 120);
    return () => clearTimeout(t);
  }, [karma]);

  const offset = circ - (drawn / 1000) * circ;

  return (
    <div style={{ position: "relative", width: radius * 2, height: radius * 2, flexShrink: 0 }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={radius} cy={radius} r={norm} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={radius} cy={radius} r={norm}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(drawn)}</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>karma</span>
      </div>
    </div>
  );
}

/* ─── Tier reveal animation ──────────────────────────────────── */
function TierBadge({ targetTier, locale }) {
  const tierSequence = TIERS.filter((t) => t.min <= targetTier.min);
  const [idx, setIdx] = useState(0);
  const [settled, setSettled] = useState(false);
  const shown = tierSequence[idx] ?? TIERS[0];

  useEffect(() => {
    if (idx < tierSequence.length - 1) {
      const t = setTimeout(() => setIdx((i) => i + 1), 600);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setSettled(true), 400);
      return () => clearTimeout(t);
    }
  }, [idx, tierSequence.length]);

  const label = locale === "hi" ? shown.labelHi : shown.label;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 14px", borderRadius: 999,
      background: shown.bg, border: `1px solid ${shown.border}`,
      transition: "all 0.4s ease",
      boxShadow: settled ? `0 0 18px ${shown.border}` : "none",
    }}>
      <span style={{ fontSize: 14 }}>
        {shown.key === "bronze" ? "🥉" : shown.key === "silver" ? "🥈" : shown.key === "gold" ? "🥇" : "💎"}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color: shown.color, letterSpacing: 1.5, textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Radar chart ────────────────────────────────────────────── */
function RubricRadar({ rubricScores, locale }) {
  const labels = RUBRIC_LABELS[locale] ?? RUBRIC_LABELS.en;
  const order = resolveRubricOrder(rubricScores);
  const data = order.map((key) => ({
    subject: labels[key] ?? key,
    score: Math.round(rubricScores?.[key] ?? 0),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 600 }}
        />
        <Radar
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.2}
          strokeWidth={1.5}
          dot={{ r: 3, fill: "#3b82f6" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, photoUrl, size = 64 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  const hue = [...(name || "W")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue}, 55%, 38%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color: "#fff",
      letterSpacing: 1,
    }}>
      {initials}
    </div>
  );
}

/* ─── QR code (public API, no extra dep) ─────────────────────── */
function QRCode({ value, size = 96 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}&bgcolor=050a18&color=93c5fd&margin=4`;
  return (
    <div style={{
      padding: 6, background: "#050a18", borderRadius: 10,
      border: "1px solid rgba(59,130,246,0.2)",
    }}>
      <img src={url} alt="QR" width={size} height={size} style={{ display: "block", borderRadius: 6 }} />
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
/**
 * PassportCard
 * Props:
 *   session  — Session object from the backend (includes rubric_scores, summary, recommendation, live_score, worker_name)
 *   worker   — Worker object { id, name, specialization, experience_years } (optional, falls back to session)
 *   channel  — "web" | "whatsapp" | "call"  (default "web")
 *   photoUrl — optional worker photo URL
 */
export default function PassportCard({ session, worker, channel = "web", photoUrl }) {
  const { locale } = useLanguage();
  const isHi = locale === "hi";

  const name = worker?.name ?? session?.worker_name ?? "—";
  const trade = worker?.specialization ?? "—";
  const score = Math.round(session?.live_score ?? 0);
  const karma = Math.min(1000, Math.round(score * 10));
  const tier = getTier(score);
  const rubric = session?.rubric_scores ?? {};
  const summary = session?.summary ?? "";
  const recommendation = session?.recommendation ?? "pending";
  const integrityFlag = session?.integrity_log?.overall_flag ?? "clear";
  const integrity = INTEGRITY[integrityFlag] ?? INTEGRITY.clear;

  const shareUrl = `${window.location.origin}/screening?worker=${worker?.id ?? ""}`;

  const recColor = recommendation === "pass" ? "#22c55e" : recommendation === "reject" ? "#ef4444" : "#f59e0b";
  const recLabelHi = recommendation === "pass" ? "चयनित" : recommendation === "reject" ? "अस्वीकृत" : "समीक्षाधीन";
  const recLabel = isHi ? recLabelHi : recommendation.toUpperCase();

  const channelMeta = {
    web:       { label: isHi ? "वेब पूर्ण" : "Web Full",    icon: "🌐" },
    whatsapp:  { label: "WhatsApp",                           icon: "💬" },
    call:      { label: isHi ? "वॉइस कॉल" : "Voice Call",   icon: "📞" },
  }[channel] ?? { label: "Web Full", icon: "🌐" };

  /* announce tier reveal */
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(true), TIERS.indexOf(tier) * 600 + 800);
    return () => clearTimeout(t);
  }, [tier]);

  return (
    <div style={{
      background: "linear-gradient(160deg, #05102a 0%, #0c1e45 60%, #05102a 100%)",
      borderRadius: 24, border: "1px solid rgba(59,130,246,0.18)",
      boxShadow: `0 0 0 1px rgba(59,130,246,0.08), 0 32px 80px rgba(5,10,26,0.7), 0 0 60px ${tier.border}`,
      color: "#fff", fontFamily: "Manrope, sans-serif",
      width: "100%", maxWidth: 420,
      overflow: "hidden", position: "relative",
    }}>
      {/* Header glow strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
        opacity: 0.8,
      }} />

      <div style={{ padding: "28px 24px 24px" }}>

        {/* Top row: avatar + name + badges */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 22 }}>
          <div style={{ position: "relative" }}>
            <Avatar name={name} photoUrl={photoUrl} size={64} />
            <div style={{
              position: "absolute", bottom: -4, right: -4,
              width: 20, height: 20, borderRadius: "50%",
              background: recColor, border: "2px solid #05102a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9,
            }}>
              {recommendation === "pass" ? "✓" : recommendation === "reject" ? "✗" : "~"}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(147,197,253,0.6)", margin: "0 0 4px" }}>
              Shramik Passport
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 2px", lineHeight: 1.2, color: "#fff" }}>
              {name}
            </h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 10px" }}>
              {trade}{worker?.experience_years != null ? ` · ${worker.experience_years}${isHi ? " साल" : " yrs"}` : ""}
            </p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <TierBadge targetTier={tier} locale={locale} />

              {/* Integrity badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 999,
                background: integrity.bg, border: `1px solid ${integrity.color}44`,
                fontSize: 9, fontWeight: 700, color: integrity.color, letterSpacing: 1, textTransform: "uppercase",
              }}>
                {isHi ? integrity.labelHi : integrity.label}
              </div>

              {/* Channel badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 999,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1,
              }}>
                {channelMeta.icon} {channelMeta.label}
              </div>
            </div>
          </div>
        </div>

        {/* Score + Karma ring */}
        <div style={{
          display: "flex", alignItems: "center", gap: 20,
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 18,
        }}>
          <KarmaRing karma={karma} color={tier.color} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>
              {isHi ? "कुल स्कोर" : "Overall Score"}
            </p>
            <div style={{ fontSize: 42, fontWeight: 900, color: tier.color, lineHeight: 1, textShadow: `0 0 30px ${tier.color}66` }}>
              {score}
              <span style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>%</span>
            </div>
            <div style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 999,
              background: `${recColor}18`, border: `1px solid ${recColor}44`,
              fontSize: 9, fontWeight: 800, color: recColor, letterSpacing: 2, textTransform: "uppercase",
            }}>
              {recLabel}
            </div>
          </div>
        </div>

        {/* Tier reveal announcement */}
        {announced && (
          <div style={{
            textAlign: "center", padding: "8px 12px", borderRadius: 12, marginBottom: 18,
            background: tier.bg, border: `1px solid ${tier.border}`,
            animation: "passportGlow 0.6s ease",
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: tier.color }}>
              {isHi
                ? `आपको ${tier.labelHi} पासपोर्ट मिला! 🎉`
                : `You earned a ${tier.label} Passport! 🎉`}
            </p>
          </div>
        )}

        {/* Radar chart */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 4px 4px" }}>
            {isHi ? "कौशल विश्लेषण" : "Skill Breakdown"}
          </p>
          <RubricRadar rubricScores={rubric} locale={locale} />
        </div>

        {/* Rubric bars */}
        <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 7 }}>
          {resolveRubricOrder(rubric).map((key) => {
            const val = Math.round(rubric[key] ?? 0);
            const barColor = val >= 70 ? "#22c55e" : val >= 45 ? "#f59e0b" : "#ef4444";
            const lbl = (RUBRIC_LABELS[locale] ?? RUBRIC_LABELS.en)[key] ?? key;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{lbl}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: barColor }}>{val}</span>
                </div>
                <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: barColor, width: `${val}%`, transition: "width 1s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* AI narrative */}
        {summary && (
          <div style={{
            marginBottom: 18, padding: "12px 14px", borderRadius: 12,
            background: "rgba(59,130,246,0.06)", borderLeft: "3px solid #3b82f6",
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(147,197,253,0.6)", margin: "0 0 6px" }}>
              {isHi ? "AI मूल्यांकन" : "AI Assessment"}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: 0 }}>
              {summary}
            </p>
          </div>
        )}

        {/* Bottom row: QR + share */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 16px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <QRCode value={shareUrl} size={80} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", margin: "0 0 4px" }}>
              {isHi ? "पासपोर्ट शेयर करें" : "Share Passport"}
            </p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", margin: "0 0 10px", wordBreak: "break-all", lineHeight: 1.5 }}>
              {shareUrl}
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              style={{
                padding: "5px 12px", borderRadius: 999, border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(59,130,246,0.08)", color: "#93c5fd",
                fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
              }}
            >
              {isHi ? "लिंक कॉपी करें" : "Copy link"}
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes passportGlow {
          0%   { opacity: 0; transform: scale(0.94); }
          60%  { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
