import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/language";

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

const TAILORS = [
  {
    id: 1,
    name: "Priya Mehra",
    location: "Mumbai, India",
    specialization: "Bridal Wear",
    experience: 9,
    rating: 4.9,
    reviews: 142,
    skills: ["Bridal Wear", "Embroidery", "Pattern Making"],
    bio: "Crafting heirloom-quality bridal pieces with intricate zardozi embroidery for over 9 years.",
    available: true,
    completedJobs: 318,
    hourlyRate: 950,
    avatar: "PM",
    color: "#3b82f6",
  },
  {
    id: 8,
    name: "Nisha Patel",
    location: "Ahmedabad, India",
    specialization: "Children's Wear",
    experience: 5,
    rating: 4.7,
    reviews: 93,
    skills: ["Children's Wear", "Alterations", "Embroidery"],
    bio: "Making durable and comfortable garments for children, school uniforms, and small-batch custom orders.",
    available: true,
    completedJobs: 197,
    hourlyRate: 720,
    avatar: "NP",
    color: "#2563eb",
  },
];

const JOBS = [
  { id: 1, title: "Bridal Lehenga Embroidery", budget: "Rs. 2000-4000", skill: "Embroidery", postedAgo: "2h", urgent: true },
  { id: 2, title: "10 Suit Alterations (Corporate)", budget: "Rs. 1500", skill: "Alterations", postedAgo: "5h", urgent: false },
  { id: 3, title: "Pattern Making - SS25 Collection", budget: "Rs. 5000-8000", skill: "Pattern Making", postedAgo: "1d", urgent: false },
  { id: 4, title: "Leather Jacket Repair and Restoration", budget: "Rs. 800-1200", skill: "Leather Work", postedAgo: "3h", urgent: true },
  { id: 5, title: "Children's School Uniform x 30 pcs", budget: "Rs. 600-800", skill: "Children's Wear", postedAgo: "2d", urgent: false },
];

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
    searchPlaceholder: "Search by name or location",
    sortTop: "Sort: Top Rated",
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
    formLabels: {
      title: "Job Title",
      skill: "Required Skill",
      budget: "Budget",
      description: "Project Description",
    },
    formPlaceholders: {
      title: "e.g. Bridal Lehenga Embroidery",
      budget: "e.g. Rs. 500-800 or negotiable",
      description: "Describe the output, quantity, deadline, and any specific requirements...",
    },
    openBudget: "Open",
    justNow: "Just now",
    skillLabels: {
      All: "All",
      "Bridal Wear": "Bridal Wear",
      Alterations: "Alterations",
      "Industrial Stitching": "Industrial Stitching",
      Embroidery: "Embroidery",
      "Leather Work": "Leather Work",
      Knitwear: "Knitwear",
      "Suit Tailoring": "Suit Tailoring",
      "Children's Wear": "Children's Wear",
      "Pattern Making": "Pattern Making",
    },
    tailorOverrides: {
      1: { specialization: "Bridal Wear", bio: "Crafting heirloom-quality bridal pieces with intricate zardozi embroidery for over 9 years." },
      8: { specialization: "Children's Wear", bio: "Making durable and comfortable garments for children, school uniforms, and small-batch custom orders." },
    },
  },
  hi: {
    available: "उपलब्ध",
    busy: "व्यस्त",
    reviews: "समीक्षाएं",
    jobsCompleted: "काम पूरे किए",
    hireNow: "अभी हायर करें",
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
    searchPlaceholder: "नाम या जगह से खोजें",
    sortTop: "क्रम: सबसे अच्छे",
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
    formLabels: {
      title: "काम का नाम",
      skill: "जरूरी skill",
      budget: "बजट",
      description: "काम का विवरण",
    },
    formPlaceholders: {
      title: "जैसे: Bridal Lehenga Embroidery",
      budget: "जैसे: Rs. 500-800 या बातचीत योग्य",
      description: "काम, मात्रा, deadline और जरूरतें बताएं...",
    },
    openBudget: "खुला",
    justNow: "अभी",
    skillLabels: {
      All: "सभी",
      "Bridal Wear": "ब्राइडल वियर",
      Alterations: "बदलाव",
      "Industrial Stitching": "इंडस्ट्रियल सिलाई",
      Embroidery: "कढ़ाई",
      "Leather Work": "चमड़े का काम",
      Knitwear: "बुनाई",
      "Suit Tailoring": "सूट टेलरिंग",
      "Children's Wear": "बच्चों के कपड़े",
      "Pattern Making": "पैटर्न बनाना",
    },
    tailorOverrides: {
      1: { specialization: "ब्राइडल वियर", bio: "9 साल से जरदोज़ी कढ़ाई के साथ शादी के बेहतरीन कपड़े बना रही हैं।" },
      8: { specialization: "बच्चों के कपड़े", bio: "बच्चों के लिए मजबूत और आरामदायक कपड़े, स्कूल यूनिफॉर्म और custom orders।" },
    },
  },
};

function StarRating({ rating, copy }) {
  return <span style={{ fontSize: 13, color: palette.accent, fontWeight: 700 }}>{copy.rating} {rating.toFixed(1)}</span>;
}

function TailorCard({ tailor, onHire, copy, skillLabel }) {
  const [hovered, setHovered] = useState(false);

  return (
    <article onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: palette.panel, border: `1px solid ${hovered ? tailor.color : palette.border}`, borderRadius: 24, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 14, transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s", boxShadow: hovered ? `0 18px 42px ${tailor.color}22` : "0 10px 28px rgba(35,49,79,0.06)", transform: hovered ? "translateY(-2px)" : "none", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 72, height: 72, background: `${tailor.color}14`, borderRadius: "0 24px 0 72px", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, background: `${tailor.color}1a`, border: `1px solid ${tailor.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 18, color: tailor.color, flexShrink: 0 }}>{tailor.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.text, margin: 0 }}>{tailor.name}</h3>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999, background: tailor.available ? palette.successSoft : "rgba(35,49,79,0.06)", color: tailor.available ? palette.success : palette.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {tailor.available ? copy.available : copy.busy}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: palette.muted }}>{tailor.location} | {tailor.experience} years</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <StarRating rating={tailor.rating} copy={copy} />
        <span style={{ fontSize: 12, color: palette.muted }}>{tailor.reviews} {copy.reviews}</span>
      </div>
      <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.65, margin: 0 }}>{tailor.bio}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tailor.skills.map((skill) => (
          <span key={skill} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: `${tailor.color}12`, border: `1px solid ${tailor.color}30`, color: tailor.color }}>
            {skillLabel(skill)}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14, borderTop: `1px solid ${palette.border}` }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: palette.muted }}>{tailor.completedJobs} {copy.jobsCompleted}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: palette.text, fontWeight: 700 }}>Rs. {tailor.hourlyRate}/hr</p>
        </div>
        <button onClick={() => onHire(tailor)} disabled={!tailor.available} style={{ padding: "10px 18px", borderRadius: 999, border: "none", background: tailor.available ? palette.primary : "#cbd5e1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: tailor.available ? "pointer" : "not-allowed" }}>
          {tailor.available ? copy.hireNow : copy.unavailable}
        </button>
      </div>
    </article>
  );
}

function JobCard({ job, copy, skillLabel }) {
  return (
    <article style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderLeft: `4px solid ${job.urgent ? palette.accent : palette.primary}`, borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 10px 24px rgba(35,49,79,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: 18, fontFamily: "Fraunces, serif", color: palette.text, flex: 1 }}>{job.title}</h4>
        {job.urgent && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "4px 8px", borderRadius: 999, background: palette.accentSoft, color: palette.accent, textTransform: "uppercase" }}>{copy.urgent}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 999, background: palette.soft, color: palette.primary, fontWeight: 700 }}>{skillLabel(job.skill)}</span>
        <span style={{ fontSize: 13, color: palette.text, fontWeight: 700, marginLeft: "auto" }}>{job.budget}</span>
        <span style={{ fontSize: 12, color: palette.muted }}>{job.postedAgo}</span>
      </div>
    </article>
  );
}

function HireModal({ tailor, onClose, copy }) {
  const [form, setForm] = useState({ name: "", email: "", project: "", date: "", budget: "" });
  const [sent, setSent] = useState(false);
  if (!tailor) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(18, 24, 39, 0.36)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0 0" }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: "28px 28px 0 0", padding: "clamp(20px, 4vw, 30px) clamp(16px, 4vw, 26px)", boxShadow: "0 -8px 40px rgba(35,49,79,0.18)", position: "relative", maxHeight: "90dvh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 18, border: "none", background: "none", color: palette.muted, fontSize: 22, cursor: "pointer" }}>x</button>
        {!sent ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: "0 0 6px" }}>{copy.hireRequest}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: palette.text, margin: 0 }}>{copy.contact} {tailor.name}</h2>
              <p style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>{tailor.specialization} | Rs. {tailor.hourlyRate}/hr</p>
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
                  <textarea value={form[field.key]} onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))} placeholder={field.placeholder} rows={3} style={inputStyle} />
                ) : (
                  <input type={field.type} value={form[field.key]} onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                )}
              </div>
            ))}
            <button onClick={() => form.name && form.email && form.project && setSent(true)} style={{ width: "100%", padding: "13px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{copy.sendHireRequest}</button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.success, margin: 0 }}>{copy.requestSent}</p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: palette.text, margin: "8px 0" }}>{copy.notified}</h2>
            <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.7 }}>{tailor.name} will receive your request and can respond in the next few hours.</p>
            <button onClick={onClose} style={{ marginTop: 18, padding: "11px 24px", borderRadius: 999, border: "none", background: palette.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{copy.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TailorBoard() {
  const { locale } = useLanguage();
  const copy = copyMap[locale] ?? copyMap.en;
  const [activeSkill, setActiveSkill] = useState("All");
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState("rating");
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [activeTab, setActiveTab] = useState("tailors");
  const [postForm, setPostForm] = useState({ title: "", skill: "Alterations", budget: "", description: "" });
  const [postedJobs, setPostedJobs] = useState(JOBS);
  const [jobPosted, setJobPosted] = useState(false);

  const skillLabel = (skill) => copy.skillLabels[skill] || skill;

  const localizedTailors = useMemo(
    () => TAILORS.map((tailor) => ({ ...tailor, specialization: copy.tailorOverrides[tailor.id]?.specialization || tailor.specialization, bio: copy.tailorOverrides[tailor.id]?.bio || tailor.bio })),
    [copy],
  );

  const localizedJobs = useMemo(
    () => postedJobs.map((job) => ({ ...job, title: copy.jobItems?.[job.id]?.title || job.title, postedAgo: job.postedAgo === "Just now" ? copy.justNow : job.postedAgo })),
    [copy, postedJobs],
  );

  const filtered = localizedTailors
    .filter((tailor) => activeSkill === "All" || tailor.skills.includes(activeSkill))
    .filter((tailor) => !availableOnly || tailor.available)
    .filter((tailor) => !search || tailor.name.toLowerCase().includes(search.toLowerCase()) || tailor.location.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => {
      if (sortBy === "rate_asc") return left.hourlyRate - right.hourlyRate;
      if (sortBy === "rate_desc") return right.hourlyRate - left.hourlyRate;
      return right.rating - left.rating;
    });

  const handlePostJob = () => {
    if (!postForm.title || !postForm.description) return;
    setPostedJobs((prev) => [{ id: Date.now(), title: postForm.title, budget: postForm.budget || copy.openBudget, skill: postForm.skill, postedAgo: copy.justNow, urgent: false }, ...prev]);
    setJobPosted(true);
    setPostForm({ title: "", skill: "Alterations", budget: "", description: "" });
    setTimeout(() => setJobPosted(false), 3000);
  };

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "clamp(16px, 4vw, 28px) clamp(12px, 3vw, 24px) 64px", color: palette.text, fontFamily: "Manrope, sans-serif" }}>
      <section style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 32, padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 28px) 22px", boxShadow: "0 18px 50px rgba(35,49,79,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 620 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: 0 }}>{copy.heroKicker}</p>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.02, margin: "10px 0 12px" }}>{copy.heroTitle}</h1>
            <p style={{ margin: 0, fontSize: 15, color: palette.muted, lineHeight: 1.75 }}>{copy.heroDescription}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { key: "tailors", label: copy.tabs.tailors },
              { key: "jobs", label: copy.tabs.jobs },
              { key: "post", label: copy.tabs.post },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "11px 18px", borderRadius: 999, border: `1px solid ${activeTab === tab.key ? palette.primary : palette.border}`, background: activeTab === tab.key ? palette.primary : palette.panel, color: activeTab === tab.key ? "#fff" : palette.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{tab.label}</button>
            ))}
          </div>
        </div>
        {activeTab === "tailors" && (
          <div style={{ marginTop: 22, borderRadius: 26, padding: "22px 22px 18px", background: "#ffffff", border: `1px solid ${palette.border}` }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {[["320+", copy.stats[0]], ["12K+", copy.stats[1]], ["4.8", copy.stats[2]]].map(([value, label]) => (
                <div key={label}>
                  <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 30, color: palette.primary }}>{value}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: palette.muted }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        {activeTab === "tailors" && (
          <>
            <div style={{ background: palette.panel, borderRadius: 24, padding: "18px 20px", border: `1px solid ${palette.border}`, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 10px 28px rgba(35,49,79,0.04)" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchPlaceholder} style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }} />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={{ ...inputStyle, flex: "0 0 auto", cursor: "pointer" }}>
                  <option value="rating">{copy.sortTop}</option>
                  <option value="rate_asc">{copy.sortAsc}</option>
                  <option value="rate_desc">{copy.sortDesc}</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: palette.text, cursor: "pointer", padding: "10px 14px", background: "#ffffff", borderRadius: 14, border: `1px solid ${availableOnly ? palette.primary : palette.border}`, fontWeight: availableOnly ? 700 : 500 }}>
                  <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} style={{ accentColor: palette.success }} />
                  {copy.availableOnly}
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map((skill) => (
                  <button key={skill} onClick={() => setActiveSkill(skill)} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${activeSkill === skill ? palette.accent : palette.border}`, background: activeSkill === skill ? palette.accent : palette.panel, color: activeSkill === skill ? "#fff" : palette.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {skillLabel(skill)}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 13, color: palette.muted, marginBottom: 18 }}>{copy.showing} {filtered.length} {copy.workers}{activeSkill !== "All" ? ` | ${skillLabel(activeSkill)}` : ""}{availableOnly ? ` | ${copy.available}` : ""}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 20 }}>
              {filtered.map((tailor) => <TailorCard key={tailor.id} tailor={tailor} onHire={setSelectedTailor} copy={copy} skillLabel={skillLabel} />)}
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
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>{copy.openKicker}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: 0, color: palette.text }}>{copy.openTitle}</h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>{copy.openDescription}</p>
            </div>
            {localizedJobs.map((job) => <JobCard key={job.id} job={job} copy={copy} skillLabel={skillLabel} />)}
          </div>
        )}

        {activeTab === "post" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ marginBottom: 24, textAlign: "center" }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>{copy.postKicker}</p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: 0, color: palette.text }}>{copy.postTitle}</h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>{copy.postDescription}</p>
            </div>
            <div style={{ background: palette.panel, borderRadius: 28, padding: "28px 24px", border: `1px solid ${palette.border}`, boxShadow: "0 12px 28px rgba(35,49,79,0.05)" }}>
              {jobPosted && <div style={{ background: palette.successSoft, border: "1px solid rgba(59,130,246,0.2)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: palette.success, fontWeight: 700 }}>{copy.postedSuccess}</div>}
              {[
                { label: copy.formLabels.title, key: "title", type: "text", placeholder: copy.formPlaceholders.title },
                { label: copy.formLabels.skill, key: "skill", type: "select" },
                { label: copy.formLabels.budget, key: "budget", type: "text", placeholder: copy.formPlaceholders.budget },
                { label: copy.formLabels.description, key: "description", type: "textarea", placeholder: copy.formPlaceholders.description },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: palette.text, display: "block", marginBottom: 6 }}>{field.label}</label>
                  {field.type === "select" ? (
                    <select value={postForm[field.key]} onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                      {SKILLS.filter((skill) => skill !== "All").map((skill) => <option key={skill}>{skillLabel(skill)}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea value={postForm[field.key]} onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))} placeholder={field.placeholder} rows={4} style={inputStyle} />
                  ) : (
                    <input type={field.type} value={postForm[field.key]} onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                  )}
                </div>
              ))}
              <button onClick={handlePostJob} style={{ width: "100%", padding: "14px", background: palette.primary, color: "#fff", border: "none", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{copy.postButton}</button>
            </div>
          </div>
        )}
      </section>

      <HireModal tailor={selectedTailor} onClose={() => setSelectedTailor(null)} copy={copy} />
    </main>
  );
}



