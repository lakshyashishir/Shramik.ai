import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/i18n/language";
import { screeningApi } from "@/services/api";
import KarmaBadge from "@/components/KarmaBadge";
import { useRole } from "@/context/role";

/* ── Tier config ─────────────────────────────────────────────────── */
const TIERS = {
  Bronze:   { color: "#cd7f32", bg: "rgba(205,127,50,0.10)",  border: "rgba(205,127,50,0.35)",  icon: "🥉", desc: { en: "Starting their verified journey. Assessed and trustworthy.", hi: "Verified यात्रा की शुरुआत। मूल्यांकित और भरोसेमंद।" } },
  Silver:   { color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.35)", icon: "🥈", desc: { en: "Proven skills. Priority listing with more job visibility.", hi: "सिद्ध कौशल। ज्यादा jobs और priority listing।" } },
  Gold:     { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.35)",  icon: "🥇", desc: { en: "Expert-level worker. Featured with premium employers.", hi: "Expert स्तर का worker। Premium employers के साथ featured।" } },
  Platinum: { color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.35)", icon: "💎", desc: { en: "Elite. Top-tier employers. Verified showcase status.", hi: "Elite। Top employers। Verified showcase status।" } },
};

const INTEGRITY = {
  clear:           { color: "#22c55e", label: "Verified Clean",   labelHi: "सत्यापित स्वच्छ" },
  minor_warning:   { color: "#f59e0b", label: "Minor Warning",    labelHi: "हल्की चेतावनी" },
  requires_review: { color: "#f97316", label: "Under Review",     labelHi: "समीक्षाधीन" },
  critical_flag:   { color: "#ef4444", label: "Flagged",          labelHi: "चिह्नित" },
};

const REC = {
  pass:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  label: "Recommended",  labelHi: "अनुशंसित" },
  hold:    { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Under Review", labelHi: "समीक्षाधीन" },
  reject:  { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  label: "Not Passed",   labelHi: "उत्तीर्ण नहीं" },
  pending: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)",label: "Pending",      labelHi: "लंबित" },
};

const CHANNEL = {
  web:      "🌐 Web",
  call:     "📞 Call",
  ivr_call: "📞 IVR Call",
  whatsapp: "💬 WhatsApp",
  offline:  "📵 Offline",
};

const RUBRIC_LABELS = {
  stitch_quality:            { en: "Stitch",    hi: "सिलाई" },
  machine_familiarity:       { en: "Machine",   hi: "मशीन" },
  technical_knowledge:       { en: "Technical", hi: "तकनीक" },
  fabric_material_knowledge: { en: "Fabric",    hi: "कपड़ा" },
  communication_confidence:  { en: "Comms",     hi: "संवाद" },
  work_output_quality:       { en: "Output",    hi: "गुणवत्ता" },
  technique_process_knowledge: { en: "Process", hi: "प्रक्रिया" },
  tool_product_knowledge:    { en: "Tools",     hi: "टूल्स" },
  joint_assembly_quality:    { en: "Joint",     hi: "जोड़" },
  tool_handling:             { en: "Tools",     hi: "औज़ार" },
  material_knowledge:        { en: "Material",  hi: "सामग्री" },
  measurement_precision:     { en: "Precision", hi: "नाप-तोल" },
  safety_protocol:           { en: "Safety",    hi: "सुरक्षा" },
  circuit_load_knowledge:    { en: "Circuit",   hi: "सर्किट" },
};

/* ── Helpers ─────────────────────────────────────────────────────── */
function avatarColor(name) {
  const hue = [...(name || "W")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}
function initials(name) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ── Avatar ──────────────────────────────────────────────────────── */
function Avatar({ name, size = 96 }) {
  const color = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${color}22`, border: `3px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color,
      fontFamily: "Fraunces, serif",
    }}>
      {initials(name)}
    </div>
  );
}

/* ── Radar chart ─────────────────────────────────────────────────── */
function RubricRadar({ rubricScores, locale }) {
  const entries = Object.entries(rubricScores).filter(([k]) => k !== "integrity_compliance" && RUBRIC_LABELS[k]);
  if (entries.length === 0) return null;
  const data = entries.map(([key, val]) => ({
    subject: (RUBRIC_LABELS[key]?.[locale] ?? RUBRIC_LABELS[key]?.en ?? key),
    score: Math.round(val),
    fullMark: 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
        <PolarGrid stroke="rgba(35,49,79,0.08)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
        <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.18} strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Skill bar ───────────────────────────────────────────────────── */
function SkillBar({ label, value }) {
  const color = value >= 70 ? "#22c55e" : value >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(35,49,79,0.06)" }}>
        <div style={{ height: "100%", borderRadius: 3, background: color, width: `${value}%`, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

/* ── Karma component breakdown ───────────────────────────────────── */
function KarmaBreakdown({ components, locale }) {
  const isHi = locale === "hi";
  const items = [
    { key: "skill",      label: isHi ? "कौशल स्कोर"   : "Skill Score",      max: 300, color: "#3b82f6" },
    { key: "integrity",  label: isHi ? "Integrity"      : "Integrity",        max: 200, color: "#22c55e" },
    { key: "reputation", label: isHi ? "प्रतिष्ठा"    : "Reputation",       max: 200, color: "#f59e0b" },
    { key: "reliability",label: isHi ? "विश्वसनीयता"  : "Reliability",      max: 150, color: "#8b5cf6" },
    { key: "growth",     label: isHi ? "विकास"         : "Growth",           max: 100, color: "#06b6d4" },
    { key: "community",  label: isHi ? "समुदाय"        : "Community",        max: 50,  color: "#f97316" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(({ key, label, max, color }) => {
        const val = components?.[key] ?? 0;
        const pct = Math.round((val / max) * 100);
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>
                {val} <span style={{ color: "#94a3b8", fontWeight: 400 }}>/ {max}</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(35,49,79,0.06)" }}>
              <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 1.2s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Portfolio item ───────────────────────────────────────────────── */
function PortfolioCard({ item }) {
  const quality = item.quality_score;
  const color = quality >= 70 ? "#22c55e" : quality >= 45 ? "#f59e0b" : "#ef4444";
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #dbe4f0", borderRadius: 16,
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <div style={{ height: 150, position: "relative", overflow: "hidden", borderBottom: "1px solid #dbe4f0" }}>
        {item.image_url && !imgError ? (
          <img
            src={item.image_url}
            alt={item.feedback ?? item.note ?? "Portfolio"}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            height: "100%", background: `linear-gradient(135deg, ${color}18, ${color}08)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
          }}>
            🧵
          </div>
        )}
        {quality != null && (
          <span style={{
            position: "absolute", bottom: 6, right: 6,
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: `${color}dd`, color: "#fff",
          }}>
            {Math.round(quality)}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        {item.feedback && <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{item.feedback}</p>}
        {item.vision_summary && <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{item.vision_summary}</p>}
        {item.note && !item.feedback && !item.vision_summary && <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{item.note}</p>}
      </div>
    </div>
  );
}

/* ── Video upload placeholder ─────────────────────────────────────── */
function MediaUploadPlaceholder({ locale }) {
  const isHi = locale === "hi";
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef();

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setFiles((prev) => [...prev, ...arr.map((f) => ({ file: f, url: URL.createObjectURL(f), type: f.type }))]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#3b82f6" : "#dbe4f0"}`,
          borderRadius: 16, padding: "28px 20px",
          textAlign: "center", cursor: "pointer",
          background: dragging ? "rgba(59,130,246,0.04)" : "#f8fafc",
          transition: "all 0.2s",
        }}
      >
        <p style={{ fontSize: 28, margin: "0 0 6px" }}>📸</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#23314f", margin: "0 0 4px" }}>
          {isHi ? "अपना काम दिखाएं" : "Showcase your work"}
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
          {isHi ? "Photos या Videos drag करें या click करें" : "Drag & drop photos or videos, or click to browse"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{ borderRadius: 12, overflow: "hidden", position: "relative", aspectRatio: "1", background: "#f1f5f9" }}>
              {f.type.startsWith("image/") ? (
                <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <video src={f.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Session history row ─────────────────────────────────────────── */
function SessionRow({ s, locale }) {
  const isHi = locale === "hi";
  const r = REC[s.recommendation] ?? REC.pending;
  const ch = CHANNEL[s.channel] ?? "🌐 Web";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #dbe4f0", flexWrap: "wrap" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${r.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: r.color }}>{s.score}</span>
      </div>
      <div style={{ flex: 1, minWidth: 80 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#23314f" }}>
          {isHi ? (r.labelHi ?? r.label) : r.label}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{ch}</p>
      </div>
      {s.ended_at && (
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          {new Date(s.ended_at).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      )}
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: r.bg, color: r.color }}>
        {isHi ? (r.labelHi ?? r.label) : r.label}
      </span>
    </div>
  );
}

/* ── Section card wrapper ────────────────────────────────────────── */
function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #dbe4f0", borderRadius: 24, padding: "22px 22px", boxShadow: "0 8px 24px rgba(35,49,79,0.05)", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 14px" }}>{children}</p>;
}

/* ── Passport data for fallback workers ──────────────────────────── */
const DEMO_PASSPORTS = {
  demo_1: {
    worker_id: "demo_1", worker_name: "Priya Mehra", specialization: "Bridal Wear",
    experience_years: 9, karma: 720, tier: "Gold", skill_score: 0.88, integrity_score: 0.95,
    rubric_scores: { stitch_quality: 91, machine_familiarity: 85, technical_knowledge: 88, fabric_material_knowledge: 84, communication_confidence: 78 },
    summary: "Priya demonstrates exceptional expertise in bridal wear and zardozi embroidery. Her stitch quality is consistently excellent and she shows deep knowledge of traditional techniques combined with modern finishing standards.",
    recommendation: "pass", integrity_flag: "clear", channel: "web",
    components: { skill: 264, integrity: 190, reputation: 150, reliability: 70, growth: 35, community: 11 },
    sessions_completed: 4, best_score: 91, all_scores: [91, 87, 83, 79],
    portfolio_snapshots: [
      {
        captured_at: "2025-12-01",
        feedback: "Intricate zardozi embroidery — gold thread tension perfect throughout",
        quality_score: 91,
        focus_areas: ["embroidery density", "thread tension"],
        image_url: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80",
      },
      {
        captured_at: "2025-10-15",
        feedback: "Clean hemline with consistent 5mm margin, no fraying visible",
        quality_score: 88,
        focus_areas: ["hem finishing", "edge quality"],
        image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
      },
      {
        captured_at: "2025-08-20",
        feedback: "Detailed mirror-work panel, alignment consistent across motifs",
        quality_score: 85,
        focus_areas: ["mirror placement", "seam tension"],
        image_url: "https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=400&q=80",
      },
    ],
    portfolio_enrichment: [
      {
        note: "Bridal lehenga with mirror work",
        vision_summary: "Intricate hand-embroidery with gold thread on red dupion silk — ceremonial grade",
        complexity: "high",
        captured_at: "2025-11-20",
        image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80",
      },
      {
        note: "Saree border embroidery — custom order",
        vision_summary: "Dense floral motifs along 6m silk border, antique gold thread, zari finish",
        complexity: "high",
        captured_at: "2025-09-05",
        image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80",
      },
    ],
    prior_work: [
      { note: "Wedding collection 2024", vision_summary: "10-piece bridal collection — gota patti and zardozi", relevance_flag: "highly_relevant" },
    ],
    session_history: [
      { id: "s1", status: "completed", score: 91, recommendation: "pass", channel: "web", ended_at: "2025-12-01" },
      { id: "s2", status: "completed", score: 87, recommendation: "pass", channel: "web", ended_at: "2025-10-15" },
      { id: "s3", status: "completed", score: 83, recommendation: "pass", channel: "web", ended_at: "2025-08-20" },
      { id: "s4", status: "completed", score: 79, recommendation: "pass", channel: "web", ended_at: "2025-06-10" },
    ],
  },
  demo_2: {
    worker_id: "demo_2", worker_name: "Nisha Patel", specialization: "Children's Wear",
    experience_years: 5, karma: 480, tier: "Silver", skill_score: 0.74, integrity_score: 0.90,
    rubric_scores: { stitch_quality: 76, machine_familiarity: 79, technical_knowledge: 72, fabric_material_knowledge: 70, communication_confidence: 82 },
    summary: "Nisha shows solid competency in children's garment production and uniform stitching. She handles multiple fabric types well and demonstrates good process knowledge for small-batch custom orders.",
    recommendation: "pass", integrity_flag: "clear", channel: "whatsapp",
    components: { skill: 166, integrity: 180, reputation: 70, reliability: 45, growth: 14, community: 5 },
    sessions_completed: 2, best_score: 76, all_scores: [76, 71],
    portfolio_snapshots: [
      {
        captured_at: "2026-01-10",
        feedback: "School uniform shirt — consistent seam allowance, clean collar attach",
        quality_score: 76,
        focus_areas: ["seam straightness", "collar finish"],
        image_url: "https://images.unsplash.com/photo-1619086303291-0ef7699e4b31?w=400&q=80",
      },
      {
        captured_at: "2025-11-22",
        feedback: "Children's kurta set — even stitching on curved hem",
        quality_score: 71,
        focus_areas: ["curve control", "edge finishing"],
        image_url: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&q=80",
      },
    ],
    portfolio_enrichment: [
      {
        note: "School uniform batch x50",
        vision_summary: "Cotton blend shirts and trousers in standard sizes 6–14, flat-felled seams",
        complexity: "medium",
        captured_at: "2026-01-10",
        image_url: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&q=80",
      },
    ],
    prior_work: [
      { note: "School uniform contract Jan 2026", vision_summary: "50 sets, cotton blend, standard sizing", relevance_flag: "relevant" },
    ],
    session_history: [
      { id: "s3", status: "completed", score: 76, recommendation: "pass", channel: "whatsapp", ended_at: "2026-01-10" },
      { id: "s4", status: "completed", score: 71, recommendation: "pass", channel: "whatsapp", ended_at: "2025-11-22" },
    ],
  },
};

/* ── Main page ───────────────────────────────────────────────────── */
export default function WorkerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const { role } = useRole();
  const isHi = locale === "hi";

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    if (DEMO_PASSPORTS[id]) {
      setPassport(DEMO_PASSPORTS[id]);
      setLoading(false);
      return;
    }
    setLoading(true);
    screeningApi.getPassport(id)
      .then(setPassport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #dbe4f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#64748b", fontSize: 14 }}>{isHi ? "लोड हो रहा है..." : "Loading profile..."}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 22, fontFamily: "Fraunces, serif", color: "#23314f" }}>{isHi ? "Profile नहीं मिली" : "Profile not found"}</p>
          <button onClick={() => navigate("/jobs")} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 999, border: "none", background: "#23314f", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {isHi ? "Job Board पर वापस जाएं" : "Back to Job Board"}
          </button>
        </div>
      </div>
    );
  }

  const tier = TIERS[passport.tier] ?? TIERS.Bronze;
  const intFl = INTEGRITY[passport.integrity_flag] ?? INTEGRITY.clear;
  const rec = REC[passport.recommendation] ?? REC.pending;
  const rubricEntries = Object.entries(passport.rubric_scores ?? {}).filter(([k]) => k !== "integrity_compliance");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(16px,4vw,32px) clamp(12px,3vw,20px) 64px", fontFamily: "Manrope, sans-serif", color: "#23314f" }}>

      {/* Back + Edit row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button
          onClick={() => navigate("/jobs")}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← {isHi ? "Job Board" : "Job Board"}
        </button>
        {role === "worker" && (
          <button
            onClick={() => navigate(`/workers/${id}/edit`)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 999,
              border: "1px solid #dbe4f0", background: "#fff",
              color: "#23314f", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            ✏️ {isHi ? "Profile संपादित करें" : "Edit Profile"}
          </button>
        )}
      </div>

      {/* ── Hero card ─────────────────────────────────────────────── */}
      <Card style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, #05102a 0%, #0c1e45 100%)",
        border: `1px solid ${tier.border}`,
        boxShadow: `0 0 60px ${tier.border}, 0 32px 80px rgba(5,10,26,0.5)`,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Tier glow strip */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar name={passport.worker_name} size={88} />

          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Name + badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.4rem,4vw,2rem)", margin: 0, color: "#fff" }}>
                {passport.worker_name}
              </h1>
              {/* Integrity badge */}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${intFl.color}18`, color: intFl.color, border: `1px solid ${intFl.color}40`, letterSpacing: 0.8 }}>
                {isHi ? intFl.labelHi : intFl.label}
              </span>
            </div>

            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
              {passport.specialization} · {passport.experience_years} {isHi ? "साल का अनुभव" : "yrs experience"}
            </p>

            {/* Tier badge + description */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ padding: "6px 14px", borderRadius: 999, background: tier.bg, border: `1px solid ${tier.border}`, display: "flex", alignItems: "center", gap: 6, boxShadow: `0 0 18px ${tier.border}` }}>
                <span style={{ fontSize: 14 }}>{tier.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: tier.color, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {passport.tier}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "6px 0 0", flex: 1, lineHeight: 1.5 }}>
                {tier.desc[locale] ?? tier.desc.en}
              </p>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: isHi ? "Sessions" : "Screenings", value: passport.sessions_completed },
                { label: isHi ? "सर्वश्रेष्ठ स्कोर" : "Best Score", value: `${passport.best_score}%` },
                { label: isHi ? "Channel" : "Channel", value: CHANNEL[passport.channel] ?? "🌐 Web" },
                { label: isHi ? "अनुशंसा" : "Status", value: isHi ? (rec.labelHi ?? rec.label) : rec.label, color: rec.color },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", margin: "0 0 2px" }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: color ?? "rgba(255,255,255,0.9)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Karma ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <KarmaBadge karma={passport.karma} size="lg" showTier={false} dark />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>
              {isHi ? "Karma Score" : "Karma Score"}
            </span>
          </div>
        </div>
      </Card>

      {/* ── 2-column grid ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="profile-grid">
        <style>{`@media(max-width:640px){ .profile-grid{ grid-template-columns:1fr !important; } }`}</style>

        {/* Karma breakdown */}
        <Card>
          <SectionTitle>{isHi ? "Karma Breakdown" : "Karma Breakdown"}</SectionTitle>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <KarmaBadge karma={passport.karma} size="md" showTier />
          </div>
          <KarmaBreakdown components={passport.components} locale={locale} />
        </Card>

        {/* Skills radar */}
        <Card>
          <SectionTitle>{isHi ? "कौशल विश्लेषण" : "Skill Breakdown"}</SectionTitle>
          {rubricEntries.length > 0 ? (
            <>
              <RubricRadar rubricScores={passport.rubric_scores} locale={locale} />
              <div style={{ marginTop: 10 }}>
                {rubricEntries.map(([key, val]) => (
                  <SkillBar
                    key={key}
                    label={RUBRIC_LABELS[key]?.[locale] ?? RUBRIC_LABELS[key]?.en ?? key}
                    value={Math.round(val)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>{isHi ? "Screening पूरा होने पर skill data दिखेगा।" : "Skill data will appear after screening is completed."}</p>
          )}
        </Card>
      </div>

      {/* ── AI Assessment ────────────────────────────────────────── */}
      {passport.summary && (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle>{isHi ? "AI मूल्यांकन" : "AI Assessment"}</SectionTitle>
          <p style={{ fontSize: 14, color: "#23314f", lineHeight: 1.75, margin: 0 }}>{passport.summary}</p>
        </Card>
      )}

      {/* ── Work Portfolio ───────────────────────────────────────── */}
      <Card style={{ marginTop: 16 }}>
        <SectionTitle>{isHi ? "काम की झलक" : "Work Portfolio"}</SectionTitle>

        {/* AI-assessed snapshots from sessions */}
        {passport.portfolio_snapshots?.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
              {isHi ? "AI-मूल्यांकित snapshots" : "AI-assessed snapshots from screening"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {passport.portfolio_snapshots.map((item, i) => (
                <PortfolioCard key={i} item={item} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Portfolio enrichment items */}
        {passport.portfolio_enrichment?.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
              {isHi ? "Portfolio Items" : "Portfolio Items"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {passport.portfolio_enrichment.map((item, i) => (
                <PortfolioCard key={i} item={item} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Manual upload */}
        <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
          {isHi ? "अपना काम share करें" : "Share your own work"}
        </p>
        <MediaUploadPlaceholder locale={locale} />
      </Card>

      {/* ── Session history ──────────────────────────────────────── */}
      {passport.session_history?.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle>{isHi ? "Assessment History" : "Assessment History"}</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {passport.session_history.map((s) => (
              <SessionRow key={s.id} s={s} locale={locale} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Hire CTA ─────────────────────────────────────────────── */}
      <Card style={{ marginTop: 16, textAlign: "center" }}>
        <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: "#23314f", margin: "0 0 6px" }}>
          {isHi ? `${passport.worker_name} को hire करें` : `Hire ${passport.worker_name}`}
        </p>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
          {isHi ? `${passport.tier} tier • Karma ${passport.karma}` : `${passport.tier} tier • ${passport.karma} Karma`}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => { navigator.clipboard?.writeText(window.location.href); }}
            style={{ padding: "11px 22px", borderRadius: 999, border: "1px solid #dbe4f0", background: "none", color: "#23314f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {isHi ? "Profile link copy करें" : "Copy Profile Link"}
          </button>
          <button
            style={{ padding: "11px 22px", borderRadius: 999, border: "none", background: "#23314f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {isHi ? "Hire Request भेजें" : "Send Hire Request"}
          </button>
        </div>
      </Card>

    </main>
  );
}
