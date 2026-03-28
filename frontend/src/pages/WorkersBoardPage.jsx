import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/language";
import { screeningApi } from "@/services/api";
import KarmaBadge from "@/components/KarmaBadge";

const palette = {
  bg: "#ffffff",
  panel: "#ffffff",
  panelAlt: "#ffffff",
  border: "#dbe4f0",
  text: "#23314f",
  muted: "#64748b",
  soft: "#ffffff",
  primary: "#23314f",
  accent: "#3b82f6",
  accentSoft: "rgba(59, 130, 246, 0.12)",
  success: "#3b82f6",
  successSoft: "rgba(59, 130, 246, 0.08)",
};

const SKILLS = [
  "All",
  "Bridal Wear",
  "Alterations",
  "Industrial Stitching",
  "Embroidery",
  "Leather Work",
  "Knitwear",
  "Suit Tailoring",
  "Children's Wear",
  "Pattern Making",
];

// Fallback workers shown when API has no data yet
const DEMO_WORKERS = [
  {
    id: "demo_1",
    name: "Priya Mehra",
    location: "Roorkee, Uttarakhand",
    specialization: "Bridal Wear",
    experience_years: 9,
    rating: 4.9,
    reviews: 142,
    skills: ["Bridal Wear", "Embroidery", "Pattern Making"],
    bio: "Crafting heirloom-quality bridal pieces with intricate zardozi embroidery for over 9 years.",
    available: true,
    completedJobs: 318,
    hourlyRate: 950,
    color: "#3b82f6",
  },
  {
    id: "demo_2",
    name: "Nisha Patel",
    location: "Roorkee, Uttarakhand",
    specialization: "Children's Wear",
    experience_years: 5,
    rating: 4.7,
    reviews: 93,
    skills: ["Children's Wear", "Alterations", "Embroidery"],
    bio: "Making durable and comfortable garments for children, school uniforms, and small-batch custom orders.",
    available: true,
    completedJobs: 197,
    hourlyRate: 720,
    color: "#2563eb",
  },
];

const FALLBACK_JOBS = [
  { id: "f1", title: "Production Tailor — Garment Factory", budget: "Rs. 14,000–18,000/month", skill: "Industrial Stitching", location: "Roorkee, Uttarakhand", availability: "Immediate", posted_at: new Date(Date.now() - 2 * 3600000).toISOString(), urgent: true },
  { id: "f2", title: "Garment Alteration Specialist", budget: "Rs. 600–900 per piece", skill: "Alterations", location: "Roorkee, Uttarakhand", availability: "Within 1 week", posted_at: new Date(Date.now() - 5 * 3600000).toISOString(), urgent: false },
  { id: "f3", title: "Canteen Helper — School Midday Meal", budget: "Rs. 9,000–11,000/month", skill: "Canteen Operations", location: "Roorkee, Uttarakhand", availability: "Immediate", posted_at: new Date(Date.now() - 3 * 3600000).toISOString(), urgent: true },
];

const JOB_LOCATIONS = ["All Locations", "Roorkee, Uttarakhand", "Haridwar", "Dehradun", "Delhi NCR", "Remote"];
const JOB_AVAILABILITIES = ["All", "Immediate", "Within 1 week", "Flexible"];

function postedAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${palette.border}`,
  borderRadius: 14,
  fontSize: 14,
  background: palette.panel,
  color: palette.text,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "Manrope, sans-serif",
  resize: "vertical",
};

const copyMap = {
  en: {
    available: "Available",
    busy: "Busy",
    reviews: "reviews",
    jobsCompleted: "jobs completed",
    hireNow: "Hire Now",
    viewPassport: "View Passport",
    unavailable: "Unavailable",
    rating: "Rating",
    urgent: "Urgent",
    hireRequest: "Hire Request",
    contact: "Contact",
    sendHireRequest: "Send Hire Request",
    requestSent: "Request Sent",
    notified: "Worker notified",
    close: "Close",
    yourName: "Your Name",
    fullName: "Full name",
    email: "Email",
    projectDetails: "Project Details",
    projectPlaceholder: "Describe what you need...",
    preferredStartDate: "Preferred Start Date",
    budget: "Budget",
    budgetPlaceholder: "e.g. Rs. 1500-3000",
    heroKicker: "Verified worker marketplace",
    heroTitle: "Find skilled workers or post practical assignments.",
    heroDescription: "This prototype keeps hiring, screening, and assignment discovery in one place.",
    tabs: { tailors: "Find Workers", jobs: "Browse Jobs", post: "Post a Job" },
    stats: ["Active Workers", "Jobs Completed", "Average Rating"],
    searchPlaceholder: "Search by name or specialization",
    sortTop: "Sort: Top Karma",
    sortAsc: "Sort: Price Low to High",
    sortDesc: "Sort: Price High to Low",
    availableOnly: "Available only",
    showing: "Showing",
    workers: "workers",
    noWorkersTitle: "No workers match the current filters",
    noWorkersDescription: "Try adjusting the search term or skill selection.",
    openKicker: "Open opportunities",
    openTitle: "Browse available jobs",
    openDescription: "Short-term work requests and assignment-based hiring briefs.",
    postKicker: "Reach skilled workers",
    postTitle: "Post a job",
    postDescription: "Describe the assignment, budget, and expected output.",
    postedSuccess: "Job posted successfully. Workers can now discover it.",
    postButton: "Post Job to 320+ Workers",
    formLabels: { title: "Job Title", skill: "Required Skill", budget: "Budget", description: "Project Description" },
    formPlaceholders: {
      title: "e.g. Bridal Lehenga Embroidery",
      budget: "e.g. Rs. 500-800 or negotiable",
      description: "Describe the output, quantity, deadline, and any specific requirements...",
    },
    openBudget: "Open",
    justNow: "Just now",
    karma: "Karma",
    yrs: "yrs",
    skillLabels: {
      All: "All", "Bridal Wear": "Bridal Wear", Alterations: "Alterations",
      "Industrial Stitching": "Industrial Stitching", Embroidery: "Embroidery",
      "Leather Work": "Leather Work", Knitwear: "Knitwear",
      "Suit Tailoring": "Suit Tailoring", "Children's Wear": "Children's Wear",
      "Pattern Making": "Pattern Making",
    },
    passportTitle: "Skill Passport",
    loadingPassport: "Loading passport...",
    experience: "experience",
    noSessionYet: "No screening sessions completed yet.",
    verified: "Verified",
    demo: "Demo",
    applyNow: "Apply Now",
    applied: "Applied ✓",
    applyModal_title: "Quick Apply",
    applyModal_sub: "Your Shramik profile will be sent to the recruiter. No forms — one tap.",
    applyModal_confirm: "Confirm Application",
    applyModal_sent: "Application Sent!",
    applyModal_sent_sub: "The recruiter will review your Skill Passport and reach out shortly.",
    filterLocation: "Location",
    filterAvailability: "Availability",
    allLocations: "All Locations",
    allAvail: "All",
  },
  hi: {
    available: "उपलब्ध",
    busy: "व्यस्त",
    reviews: "समीक्षाएं",
    jobsCompleted: "काम पूरे किए",
    hireNow: "अभी हायर करें",
    viewPassport: "Passport देखें",
    unavailable: "उपलब्ध नहीं",
    rating: "रेटिंग",
    urgent: "जरूरी",
    hireRequest: "हायर रिक्वेस्ट",
    contact: "संपर्क करें",
    sendHireRequest: "हायर रिक्वेस्ट भेजें",
    requestSent: "रिक्वेस्ट भेजी गई",
    notified: "Worker को सूचित किया गया",
    close: "बंद करें",
    yourName: "आपका नाम",
    fullName: "पूरा नाम",
    email: "ईमेल",
    projectDetails: "प्रोजेक्ट विवरण",
    projectPlaceholder: "आपको क्या चाहिए, बताएं...",
    preferredStartDate: "शुरुआत की तारीख",
    budget: "बजट",
    budgetPlaceholder: "जैसे Rs. 1500-3000",
    heroKicker: "Verified worker marketplace",
    heroTitle: "कुशल कारीगर खोजें या काम पोस्ट करें।",
    heroDescription: "यह platform hiring, screening और काम की खोज एक जगह करता है।",
    tabs: { tailors: "Worker खोजें", jobs: "काम देखें", post: "काम पोस्ट करें" },
    stats: ["सक्रिय Workers", "पूरे किए काम", "औसत रेटिंग"],
    searchPlaceholder: "नाम या skill से खोजें",
    sortTop: "क्रम: सबसे ज्यादा Karma",
    sortAsc: "क्रम: कम कीमत पहले",
    sortDesc: "क्रम: ज्यादा कीमत पहले",
    availableOnly: "सिर्फ उपलब्ध",
    showing: "दिखाए जा रहे हैं",
    workers: "workers",
    noWorkersTitle: "कोई worker नहीं मिला",
    noWorkersDescription: "search या skill filter बदलकर देखें।",
    openKicker: "खुले अवसर",
    openTitle: "उपलब्ध काम देखें",
    openDescription: "Short-term काम और assignment-based hiring।",
    postKicker: "कुशल workers तक पहुंचें",
    postTitle: "काम पोस्ट करें",
    postDescription: "काम, बजट और जरूरी चीजें बताएं।",
    postedSuccess: "काम पोस्ट हो गया। Workers अब इसे देख सकते हैं।",
    postButton: "320+ Workers को पोस्ट करें",
    formLabels: { title: "काम का नाम", skill: "जरूरी skill", budget: "बजट", description: "काम का विवरण" },
    formPlaceholders: {
      title: "जैसे: Bridal Lehenga Embroidery",
      budget: "जैसे: Rs. 500-800 या बातचीत योग्य",
      description: "काम, मात्रा, deadline और जरूरतें बताएं...",
    },
    openBudget: "खुला",
    justNow: "अभी",
    karma: "Karma",
    yrs: "साल",
    skillLabels: {
      All: "सभी", "Bridal Wear": "ब्राइडल वियर", Alterations: "बदलाव",
      "Industrial Stitching": "इंडस्ट्रियल सिलाई", Embroidery: "कढ़ाई",
      "Leather Work": "चमड़े का काम", Knitwear: "बुनाई",
      "Suit Tailoring": "सूट टेलरिंग", "Children's Wear": "बच्चों के कपड़े",
      "Pattern Making": "पैटर्न बनाना",
    },
    passportTitle: "Skill Passport",
    loadingPassport: "Passport लोड हो रहा है...",
    experience: "अनुभव",
    noSessionYet: "अभी तक कोई screening session पूरा नहीं हुआ।",
    verified: "सत्यापित",
    demo: "डेमो",
    applyNow: "अभी अप्लाई करें",
    applied: "अप्लाई हो गया ✓",
    applyModal_title: "Quick Apply",
    applyModal_sub: "आपकी Shramik profile recruiter को भेजी जाएगी। कोई form नहीं — एक tap।",
    applyModal_confirm: "Application भेजें",
    applyModal_sent: "Application भेज दी गई!",
    applyModal_sent_sub: "Recruiter आपका Skill Passport देखेगा और जल्द संपर्क करेगा।",
    filterLocation: "Location",
    filterAvailability: "उपलब्धता",
    allLocations: "सभी Locations",
    allAvail: "सभी",
  },
};

/* ── Colour helpers ─────────────────────────────────────────────── */
function workerColor(name) {
  const hue = [...(name || "W")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 60%, 38%)`;
}

function workerInitials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ── Worker card ────────────────────────────────────────────────── */
function WorkerCard({ worker, onHire, onViewPassport, copy, skillLabel, karma }) {
  const [hovered, setHovered] = useState(false);
  const color = worker.color ?? workerColor(worker.name);
  const initials = worker.avatar ?? workerInitials(worker.name);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: palette.panel,
        border: `1px solid ${hovered ? color : palette.border}`,
        borderRadius: 24,
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered ? `0 18px 42px ${color}22` : "0 10px 28px rgba(35,49,79,0.06)",
        transform: hovered ? "translateY(-2px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Corner accent */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 72, height: 72, background: `${color}14`, borderRadius: "0 24px 0 72px", pointerEvents: "none" }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 54, height: 54, borderRadius: 18,
          background: `${color}1a`, border: `1px solid ${color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 18, color,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: palette.text, margin: 0 }}>
              {worker.name}
            </h3>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
              background: "rgba(34,197,94,0.1)", color: "#16a34a", letterSpacing: 0.5,
            }}>
              {copy.verified}
            </span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: palette.muted }}>
            {worker.specialization}
            {worker.location ? ` · ${worker.location}` : ""}
            {" · "}
            {worker.experience_years ?? worker.experience} {copy.yrs}
          </p>
        </div>
      </div>

      {/* Karma ring or rating */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {karma ? (
          <KarmaBadge karma={karma.karma} size="sm" showTier />
        ) : worker.rating ? (
          <span style={{ fontSize: 13, color: palette.accent, fontWeight: 700 }}>
            {copy.rating} {worker.rating.toFixed(1)}
            <span style={{ fontSize: 12, color: palette.muted, fontWeight: 400 }}> ({worker.reviews} {copy.reviews})</span>
          </span>
        ) : null}
        {worker.completedJobs && (
          <span style={{ fontSize: 12, color: palette.muted }}>{worker.completedJobs} {copy.jobsCompleted}</span>
        )}
      </div>

      {/* Bio */}
      {worker.bio && (
        <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.65, margin: 0 }}>{worker.bio}</p>
      )}

      {/* Skill tags */}
      {worker.skills && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {worker.skills.map((skill) => (
            <span key={skill} style={{
              fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
              background: `${color}12`, border: `1px solid ${color}30`, color,
            }}>
              {skillLabel(skill)}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, paddingTop: 14, borderTop: `1px solid ${palette.border}`, flexWrap: "wrap",
      }}>
        <div>
          {worker.hourlyRate && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: palette.text }}>
              Rs. {worker.hourlyRate}/hr
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onViewPassport(worker)}
            style={{
              padding: "10px 14px", minHeight: 44, borderRadius: 999,
              border: `1px solid ${color}40`,
              background: `${color}0d`, color, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            {copy.viewPassport}
          </button>
          <button
            onClick={() => onHire(worker)}
            disabled={worker.available === false}
            style={{
              padding: "10px 18px", minHeight: 44, borderRadius: 999, border: "none",
              background: worker.available !== false ? palette.primary : "#cbd5e1",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: worker.available !== false ? "pointer" : "not-allowed",
            }}
          >
            {worker.available !== false ? copy.hireNow : copy.unavailable}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Job card ────────────────────────────────────────────────────── */
function JobCard({ job, copy, skillLabel, applied, onApply }) {
  const loc = job.location || "";
  const avail = job.availability || (job.urgent ? "Immediate" : "Within 1 week");
  const isApplied = applied;

  return (
    <article style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderLeft: `4px solid ${job.urgent ? palette.accent : palette.primary}`,
      borderRadius: 18, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10,
      boxShadow: "0 10px 24px rgba(35,49,79,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: 17, fontFamily: "Fraunces, serif", color: palette.text, flex: 1, lineHeight: 1.3 }}>{job.title}</h4>
        {job.urgent && (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "4px 8px", borderRadius: 999, background: palette.accentSoft, color: palette.accent, textTransform: "uppercase", flexShrink: 0 }}>
            {copy.urgent}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(35,49,79,0.06)", color: palette.primary, fontWeight: 700 }}>{skillLabel(job.skill)}</span>
        {loc && <span style={{ fontSize: 11, color: palette.muted }}>📍 {loc}</span>}
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: avail === "Immediate" ? "rgba(59,130,246,0.08)" : "rgba(35,49,79,0.04)", color: avail === "Immediate" ? palette.accent : palette.muted, fontWeight: 600 }}>{avail}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, color: palette.text, fontWeight: 700 }}>{job.budget}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: palette.muted }}>{job.posted_at ? postedAgo(job.posted_at) : (job.postedAgo || "")}</span>
          <button
            onClick={() => !isApplied && onApply(job)}
            style={{
              padding: "8px 18px", borderRadius: 999, border: "none",
              background: isApplied ? "rgba(22,163,74,0.1)" : palette.primary,
              color: isApplied ? "#16a34a" : "#fff",
              fontSize: 13, fontWeight: 700, cursor: isApplied ? "default" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {isApplied ? copy.applied : copy.applyNow}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Hire modal ─────────────────────────────────────────────────── */
function HireModal({ worker, onClose, copy }) {
  const [form, setForm] = useState({ name: "", email: "", project: "", date: "", budget: "" });
  const [sent, setSent] = useState(false);
  if (!worker) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(18,24,39,0.36)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: "28px 28px 0 0", padding: "clamp(20px,4vw,30px) clamp(16px,4vw,26px)", boxShadow: "0 -8px 40px rgba(35,49,79,0.18)", position: "relative", maxHeight: "92dvh", overflowY: "auto" }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 18, border: "none", background: "none", color: palette.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        {!sent ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: "0 0 6px" }}>{copy.hireRequest}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: palette.text, margin: 0 }}>{copy.contact} {worker.name}</h2>
              <p style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>{worker.specialization}</p>
            </div>
            {[
              { label: copy.yourName, key: "name", type: "text", placeholder: copy.fullName },
              { label: copy.email, key: "email", type: "email", placeholder: "your@email.com" },
              { label: copy.projectDetails, key: "project", type: "textarea", placeholder: copy.projectPlaceholder },
              { label: copy.preferredStartDate, key: "date", type: "date", placeholder: "" },
              { label: copy.budget, key: "budget", type: "text", placeholder: copy.budgetPlaceholder },
            ].map((field) => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: palette.text, display: "block", marginBottom: 6 }}>{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea value={form[field.key]} onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} rows={3} style={inputStyle} />
                ) : (
                  <input type={field.type} value={form[field.key]} onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                )}
              </div>
            ))}
            <button onClick={() => form.name && form.email && form.project && setSent(true)} style={{ width: "100%", padding: "13px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              {copy.sendHireRequest}
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#22c55e", margin: 0 }}>{copy.requestSent}</p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: palette.text, margin: "8px 0" }}>{copy.notified}</h2>
            <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.7 }}>{worker.name} will receive your request shortly.</p>
            <button onClick={onClose} style={{ marginTop: 18, padding: "11px 24px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{copy.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ── Apply modal ────────────────────────────────────────────────── */
function ApplyModal({ job, onClose, onConfirm, copy }) {
  const [sent, setSent] = useState(false);
  if (!job) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(18,24,39,0.36)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: "28px 28px 0 0", padding: "28px 24px 32px", boxShadow: "0 -8px 40px rgba(35,49,79,0.18)", position: "relative" }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 18, border: "none", background: "none", color: palette.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        {!sent ? (
          <>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: "0 0 6px" }}>{copy.applyModal_title}</p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: palette.text, margin: "0 0 8px" }}>{job.title}</h2>
            <p style={{ fontSize: 13, color: palette.muted, margin: "0 0 6px" }}>📍 {job.location || "Location not specified"} · {job.budget}</p>
            <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.65, margin: "12px 0 22px", padding: "12px", background: "rgba(59,130,246,0.04)", borderRadius: 12, border: "1px solid rgba(59,130,246,0.12)" }}>
              {copy.applyModal_sub}
            </p>
            <button
              onClick={() => { setSent(true); onConfirm(job.id); }}
              style={{ width: "100%", padding: "14px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              {copy.applyModal_confirm}
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#16a34a", margin: "0 0 8px" }}>{copy.applyModal_sent}</p>
            <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.7, margin: "0 0 20px" }}>{copy.applyModal_sent_sub}</p>
            <button onClick={onClose} style={{ padding: "11px 28px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{copy.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ── Main page ──────────────────────────────────────────────────── */
export default function WorkersBoardPage() {
  const { locale } = useLanguage();
  const copy = copyMap[locale] ?? copyMap.en;
  const navigate = useNavigate();

  const [apiWorkers, setApiWorkers] = useState([]);
  const [karmaMap, setKarmaMap] = useState({});
  const [activeSkill, setActiveSkill] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("karma");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [activeTab, setActiveTab] = useState("tailors");
  const [postForm, setPostForm] = useState({ title: "", skill: "Alterations", budget: "", description: "" });
  const [postedJobs, setPostedJobs] = useState([]);
  const [jobPosted, setJobPosted] = useState(false);
  const [jobLocFilter, setJobLocFilter] = useState("All Locations");
  const [jobAvailFilter, setJobAvailFilter] = useState("All");
  const [appliedJobs, setAppliedJobs] = useState({});
  const [applyTarget, setApplyTarget] = useState(null);

  const skillLabel = (skill) => copy.skillLabels[skill] || skill;

  // Fetch jobs from API
  useEffect(() => {
    screeningApi.listJobs()
      .then((jobs) => setPostedJobs(jobs && jobs.length > 0 ? jobs : FALLBACK_JOBS))
      .catch(() => setPostedJobs(FALLBACK_JOBS));
  }, []);

  // Fetch real workers from API
  useEffect(() => {
    screeningApi.listWorkers()
      .then((workers) => {
        if (workers && workers.length > 0) {
          setApiWorkers(workers.map((w) => ({
            ...w,
            color: workerColor(w.name),
            available: true,
            location: w.location || "Roorkee, Uttarakhand",
          })));
          // Fetch karma for each worker
          workers.forEach((w) => {
            screeningApi.getWorkerKarma(w.id)
              .then((k) => setKarmaMap((prev) => ({ ...prev, [w.id]: k })))
              .catch(() => {});
          });
        }
      })
      .catch(() => {});
  }, []);

  // Merge: prefer API workers, fall back to demo if none
  const allWorkers = apiWorkers.length > 0 ? apiWorkers : DEMO_WORKERS;

  const filtered = useMemo(() => {
    return allWorkers
      .filter((w) => activeSkill === "All" || (w.specialization || "").includes(activeSkill) || (w.skills ?? []).includes(activeSkill))
      .filter((w) => !search || w.name.toLowerCase().includes(search.toLowerCase()) || (w.specialization || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "karma") {
          const ka = karmaMap[a.id]?.karma ?? (a.rating ? a.rating * 100 : 0);
          const kb = karmaMap[b.id]?.karma ?? (b.rating ? b.rating * 100 : 0);
          return kb - ka;
        }
        if (sortBy === "rate_asc") return (a.hourlyRate ?? 0) - (b.hourlyRate ?? 0);
        if (sortBy === "rate_desc") return (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0);
        return 0;
      });
  }, [allWorkers, activeSkill, search, sortBy, karmaMap]);

  const filteredJobs = useMemo(() => {
    return postedJobs.filter((job) => {
      if (jobLocFilter !== "All Locations" && !((job.location || "").includes(jobLocFilter))) return false;
      if (jobAvailFilter !== "All") {
        const avail = job.availability || (job.urgent ? "Immediate" : "Within 1 week");
        if (avail !== jobAvailFilter) return false;
      }
      return true;
    });
  }, [postedJobs, jobLocFilter, jobAvailFilter]);

  const handlePostJob = () => {
    if (!postForm.title || !postForm.description) return;
    const optimistic = { id: `opt_${Date.now()}`, title: postForm.title, budget: postForm.budget || copy.openBudget, skill: postForm.skill, posted_at: new Date().toISOString(), urgent: false };
    setPostedJobs((prev) => [optimistic, ...prev]);
    setJobPosted(true);
    setPostForm({ title: "", skill: "Alterations", budget: "", description: "" });
    setTimeout(() => setJobPosted(false), 3000);
    screeningApi.createJob({ title: optimistic.title, budget: optimistic.budget, skill: optimistic.skill, description: postForm.description })
      .then((created) => setPostedJobs((prev) => prev.map((j) => j.id === optimistic.id ? created : j)))
      .catch(() => {});
  };

  const totalKarma = Object.values(karmaMap);
  const avgKarma = totalKarma.length > 0
    ? Math.round(totalKarma.reduce((s, k) => s + k.karma, 0) / totalKarma.length)
    : null;

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "clamp(16px,4vw,28px) clamp(12px,3vw,24px) 64px", color: palette.text, fontFamily: "Manrope, sans-serif" }}>
      {/* Hero */}
      <section style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 32, padding: "clamp(16px,4vw,28px) clamp(16px,4vw,28px) 22px", boxShadow: "0 18px 50px rgba(35,49,79,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 620 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: 0 }}>{copy.heroKicker}</p>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(2rem,5vw,3.5rem)", lineHeight: 1.02, margin: "10px 0 12px" }}>{copy.heroTitle}</h1>
            <p style={{ margin: 0, fontSize: 15, color: palette.muted, lineHeight: 1.75 }}>{copy.heroDescription}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { key: "tailors", label: copy.tabs.tailors },
              { key: "jobs", label: copy.tabs.jobs },
              { key: "post", label: copy.tabs.post },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{ padding: "11px 18px", borderRadius: 999, border: `1px solid ${activeTab === tab.key ? palette.primary : palette.border}`, background: activeTab === tab.key ? palette.primary : palette.panel, color: activeTab === tab.key ? "#fff" : palette.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "tailors" && (
          <div style={{ marginTop: 22, borderRadius: 26, padding: "22px 22px 18px", background: "#ffffff", border: `1px solid ${palette.border}` }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {[
                [String(allWorkers.length > 2 ? allWorkers.length : "320+"), copy.stats[0]],
                [apiWorkers.length > 0 ? String(apiWorkers.length) + " live" : "12K+", copy.stats[1]],
                [avgKarma ? avgKarma + " avg" : "4.8", copy.stats[2]],
              ].map(([value, label]) => (
                <div key={label}>
                  <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 30, color: palette.primary }}>{value}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: palette.muted }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Content */}
      <section style={{ marginTop: 26 }}>
        {activeTab === "tailors" && (
          <>
            {/* Filters */}
            <div style={{ background: palette.panel, borderRadius: 24, padding: "18px 20px", border: `1px solid ${palette.border}`, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 10px 28px rgba(35,49,79,0.04)" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }}
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, flex: "0 0 auto", cursor: "pointer" }}>
                  <option value="karma">{copy.sortTop}</option>
                  <option value="rate_asc">{copy.sortAsc}</option>
                  <option value="rate_desc">{copy.sortDesc}</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => setActiveSkill(skill)}
                    style={{ padding: "8px 14px", minHeight: 36, borderRadius: 999, border: `1px solid ${activeSkill === skill ? palette.accent : palette.border}`, background: activeSkill === skill ? palette.accent : palette.panel, color: activeSkill === skill ? "#fff" : palette.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {skillLabel(skill)}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 13, color: palette.muted, marginBottom: 18 }}>
              {copy.showing} {filtered.length} {copy.workers}
              {activeSkill !== "All" ? ` | ${skillLabel(activeSkill)}` : ""}
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onHire={setSelectedWorker}
                  onViewPassport={(w) => navigate(`/workers/${w.id}`)}
                  copy={copy}
                  skillLabel={skillLabel}
                  karma={karmaMap[worker.id]}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "54px 20px", background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 24, color: palette.muted }}>
                  <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.text, margin: "0 0 8px" }}>{copy.noWorkersTitle}</p>
                  <p style={{ margin: 0, fontSize: 14 }}>{copy.noWorkersDescription}</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "jobs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ marginBottom: 4 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>{copy.openKicker}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", margin: 0, color: palette.text }}>{copy.openTitle}</h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>{copy.openDescription}</p>
            </div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 18, padding: "14px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: palette.muted }}>{copy.filterLocation}</label>
                <select value={jobLocFilter} onChange={(e) => setJobLocFilter(e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 13 }}>
                  {JOB_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: palette.muted }}>{copy.filterAvailability}</label>
                <select value={jobAvailFilter} onChange={(e) => setJobAvailFilter(e.target.value)} style={{ ...inputStyle, padding: "8px 10px", fontSize: 13 }}>
                  {JOB_AVAILABILITIES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <p style={{ fontSize: 12, color: palette.muted, margin: "0 0 4px" }}>{filteredJobs.length} jobs found</p>
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                copy={copy}
                skillLabel={skillLabel}
                applied={!!appliedJobs[job.id]}
                onApply={setApplyTarget}
              />
            ))}
            {filteredJobs.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 18, color: palette.muted }}>
                <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: palette.text, margin: "0 0 8px" }}>No jobs match</p>
                <p style={{ margin: 0, fontSize: 14 }}>Try adjusting the filters above.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "post" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ marginBottom: 24, textAlign: "center" }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>{copy.postKicker}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", margin: 0, color: palette.text }}>{copy.postTitle}</h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>{copy.postDescription}</p>
            </div>
            <div style={{ background: palette.panel, borderRadius: 28, padding: "28px 24px", border: `1px solid ${palette.border}`, boxShadow: "0 12px 28px rgba(35,49,79,0.05)" }}>
              {jobPosted && (
                <div style={{ background: palette.successSoft, border: "1px solid rgba(59,130,246,0.2)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: palette.success, fontWeight: 700 }}>
                  {copy.postedSuccess}
                </div>
              )}
              {[
                { label: copy.formLabels.title, key: "title", type: "text", placeholder: copy.formPlaceholders.title },
                { label: copy.formLabels.skill, key: "skill", type: "select" },
                { label: copy.formLabels.budget, key: "budget", type: "text", placeholder: copy.formPlaceholders.budget },
                { label: copy.formLabels.description, key: "description", type: "textarea", placeholder: copy.formPlaceholders.description },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: palette.text, display: "block", marginBottom: 6 }}>{field.label}</label>
                  {field.type === "select" ? (
                    <select value={postForm[field.key]} onChange={(e) => setPostForm((p) => ({ ...p, [field.key]: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                      {SKILLS.filter((s) => s !== "All").map((s) => <option key={s}>{skillLabel(s)}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea value={postForm[field.key]} onChange={(e) => setPostForm((p) => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} rows={4} style={inputStyle} />
                  ) : (
                    <input type={field.type} value={postForm[field.key]} onChange={(e) => setPostForm((p) => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                  )}
                </div>
              ))}
              <button
                onClick={handlePostJob}
                style={{ width: "100%", padding: "14px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {copy.postButton}
              </button>
            </div>
          </div>
        )}
      </section>

      <HireModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} copy={copy} />
      <ApplyModal
        job={applyTarget}
        onClose={() => setApplyTarget(null)}
        onConfirm={(id) => setAppliedJobs((prev) => ({ ...prev, [id]: true }))}
        copy={copy}
      />
    </main>
  );
}
