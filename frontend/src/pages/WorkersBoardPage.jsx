import { useState } from "react";

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

function StarRating({ rating }) {
  return (
    <span style={{ fontSize: 13, color: palette.accent, fontWeight: 700 }}>
      Rating {rating.toFixed(1)}
    </span>
  );
}

function TailorCard({ tailor, onHire }) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: palette.panel,
        border: `1px solid ${hovered ? tailor.color : palette.border}`,
        borderRadius: 24,
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered ? `0 18px 42px ${tailor.color}22` : "0 10px 28px rgba(35,49,79,0.06)",
        transform: hovered ? "translateY(-2px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 72,
          height: 72,
          background: `${tailor.color}14`,
          borderRadius: "0 24px 0 72px",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            background: `${tailor.color}1a`,
            border: `1px solid ${tailor.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Fraunces, serif",
            fontWeight: 700,
            fontSize: 18,
            color: tailor.color,
            flexShrink: 0,
          }}
        >
          {tailor.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.text, margin: 0 }}>
              {tailor.name}
            </h3>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: 999,
                background: tailor.available ? palette.successSoft : "rgba(35,49,79,0.06)",
                color: tailor.available ? palette.success : palette.muted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {tailor.available ? "Available" : "Busy"}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: palette.muted }}>
            {tailor.location} | {tailor.experience} years experience
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <StarRating rating={tailor.rating} />
        <span style={{ fontSize: 12, color: palette.muted }}>{tailor.reviews} reviews</span>
      </div>

      <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.65, margin: 0 }}>
        {tailor.bio}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tailor.skills.map((skill) => (
          <span
            key={skill}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: 999,
              background: `${tailor.color}12`,
              border: `1px solid ${tailor.color}30`,
              color: tailor.color,
            }}
          >
            {skill}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 14,
          borderTop: `1px solid ${palette.border}`,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, color: palette.muted }}>{tailor.completedJobs} jobs completed</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: palette.text, fontWeight: 700 }}>
            Rs. {tailor.hourlyRate}/hr
          </p>
        </div>
        <button
          onClick={() => onHire(tailor)}
          disabled={!tailor.available}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            border: "none",
            background: tailor.available ? palette.primary : "#d7ccbf",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: tailor.available ? "pointer" : "not-allowed",
          }}
        >
          {tailor.available ? "Hire Now" : "Unavailable"}
        </button>
      </div>
    </article>
  );
}

function JobCard({ job }) {
  return (
    <article
      style={{
        background: palette.panel,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${job.urgent ? palette.accent : palette.primary}`,
        borderRadius: 18,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 10px 24px rgba(35,49,79,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0, fontSize: 18, fontFamily: "Fraunces, serif", color: palette.text, flex: 1 }}>
          {job.title}
        </h4>
        {job.urgent && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              padding: "4px 8px",
              borderRadius: 999,
              background: palette.accentSoft,
              color: palette.accent,
              textTransform: "uppercase",
            }}
          >
            Urgent
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            padding: "5px 10px",
            borderRadius: 999,
            background: palette.soft,
            color: palette.primary,
            fontWeight: 700,
          }}
        >
          {job.skill}
        </span>
        <span style={{ fontSize: 13, color: palette.text, fontWeight: 700, marginLeft: "auto" }}>{job.budget}</span>
        <span style={{ fontSize: 12, color: palette.muted }}>{job.postedAgo} ago</span>
      </div>
    </article>
  );
}

function HireModal({ tailor, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", project: "", date: "", budget: "" });
  const [sent, setSent] = useState(false);

  if (!tailor) return null;

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.project) return;
    setSent(true);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(18, 24, 39, 0.36)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: palette.panel,
          border: `1px solid ${palette.border}`,
          borderRadius: 28,
          padding: "30px 26px",
          boxShadow: "0 24px 80px rgba(35,49,79,0.18)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 18,
            border: "none",
            background: "none",
            color: palette.muted,
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          x
        </button>

        {!sent ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: "0 0 6px" }}>
                Hire Request
              </p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: palette.text, margin: 0 }}>
                Contact {tailor.name}
              </h2>
              <p style={{ fontSize: 13, color: palette.muted, marginTop: 6 }}>
                {tailor.specialization} | Rs. {tailor.hourlyRate}/hr
              </p>
            </div>

            {[
              { label: "Your Name", key: "name", type: "text", placeholder: "Full name" },
              { label: "Email", key: "email", type: "email", placeholder: "your@email.com" },
              { label: "Project Details", key: "project", type: "textarea", placeholder: "Describe what you need..." },
              { label: "Preferred Start Date", key: "date", type: "date", placeholder: "" },
              { label: "Budget", key: "budget", type: "text", placeholder: "e.g. Rs. 1500-3000" },
            ].map((field) => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: palette.text, display: "block", marginBottom: 6 }}>
                  {field.label}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={form[field.key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}

            <button
              onClick={handleSubmit}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 999,
                border: "none",
                background: palette.primary,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Send Hire Request
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.success, margin: 0 }}>
              Request Sent
            </p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: palette.text, margin: "8px 0" }}>
              Tailor notified
            </h2>
            <p style={{ fontSize: 14, color: palette.muted, lineHeight: 1.7 }}>
              {tailor.name} will receive your request and can respond in the next few hours.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 18,
                padding: "11px 24px",
                borderRadius: 999,
                border: "none",
                background: palette.primary,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TailorBoard() {
  const [activeSkill, setActiveSkill] = useState("All");
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState("rating");
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [activeTab, setActiveTab] = useState("tailors");
  const [postForm, setPostForm] = useState({ title: "", skill: "Alterations", budget: "", description: "" });
  const [postedJobs, setPostedJobs] = useState(JOBS);
  const [jobPosted, setJobPosted] = useState(false);

  const filtered = TAILORS.filter((tailor) => activeSkill === "All" || tailor.skills.includes(activeSkill))
    .filter((tailor) => !availableOnly || tailor.available)
    .filter(
      (tailor) =>
        !search ||
        tailor.name.toLowerCase().includes(search.toLowerCase()) ||
        tailor.location.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((left, right) => {
      if (sortBy === "rate_asc") return left.hourlyRate - right.hourlyRate;
      if (sortBy === "rate_desc") return right.hourlyRate - left.hourlyRate;
      return right.rating - left.rating;
    });

  const handlePostJob = () => {
    if (!postForm.title || !postForm.description) return;
    const newJob = {
      id: Date.now(),
      title: postForm.title,
      budget: postForm.budget || "Open",
      skill: postForm.skill,
      postedAgo: "Just now",
      urgent: false,
    };
    setPostedJobs((prev) => [newJob, ...prev]);
    setJobPosted(true);
    setPostForm({ title: "", skill: "Alterations", budget: "", description: "" });
    setTimeout(() => setJobPosted(false), 3000);
  };

  return (
    <main
      style={{
        maxWidth: 1240,
        margin: "0 auto",
        padding: "28px 24px 64px",
        color: palette.text,
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <section
        style={{
          background: palette.panel,
          border: `1px solid ${palette.border}`,
          borderRadius: 32,
          padding: "28px 28px 22px",
          boxShadow: "0 18px 50px rgba(35,49,79,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 620 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.accent, margin: 0 }}>
              Verified worker marketplace
            </p>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.02, margin: "10px 0 12px" }}>
              Find skilled workers or post practical assignments.
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: palette.muted, lineHeight: 1.75 }}>
              This prototype keeps hiring, screening, and assignment discovery in one place. The layout stays marketplace-first,
              but the styling now matches the main Shramik.ai product shell.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { key: "tailors", label: "Find Workers" },
              { key: "jobs", label: "Browse Jobs" },
              { key: "post", label: "Post a Job" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "11px 18px",
                  borderRadius: 999,
                  border: `1px solid ${activeTab === tab.key ? palette.primary : palette.border}`,
                  background: activeTab === tab.key ? palette.primary : palette.panel,
                  color: activeTab === tab.key ? "#fff" : palette.text,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "tailors" && (
          <div
            style={{
              marginTop: 22,
              borderRadius: 26,
              padding: "22px 22px 18px",
              background: "#ffffff",
              border: `1px solid ${palette.border}`,
            }}
          >
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {[
                ["320+", "Active Workers"],
                ["12K+", "Jobs Completed"],
                ["4.8", "Average Rating"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 30, color: palette.primary }}>{value}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: palette.muted }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        {activeTab === "tailors" && (
          <>
            <div
              style={{
                background: palette.panel,
                borderRadius: 24,
                padding: "18px 20px",
                border: `1px solid ${palette.border}`,
                marginBottom: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                boxShadow: "0 10px 28px rgba(35,49,79,0.04)",
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or location"
                  style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }}
                />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={{ ...inputStyle, flex: "0 0 auto", cursor: "pointer" }}>
                  <option value="rating">Sort: Top Rated</option>
                  <option value="rate_asc">Sort: Price Low to High</option>
                  <option value="rate_desc">Sort: Price High to Low</option>
                </select>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: palette.text,
                    cursor: "pointer",
                    padding: "10px 14px",
                    background: "#ffffff",
                    borderRadius: 14,
                    border: `1px solid ${availableOnly ? palette.primary : palette.border}`,
                    fontWeight: availableOnly ? 700 : 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(event) => setAvailableOnly(event.target.checked)}
                    style={{ accentColor: palette.success }}
                  />
                  Available only
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => setActiveSkill(skill)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: `1px solid ${activeSkill === skill ? palette.accent : palette.border}`,
                      background: activeSkill === skill ? palette.accent : palette.panel,
                      color: activeSkill === skill ? "#fff" : palette.muted,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 13, color: palette.muted, marginBottom: 18 }}>
              Showing {filtered.length} worker{filtered.length !== 1 ? "s" : ""}
              {activeSkill !== "All" ? ` | ${activeSkill}` : ""}
              {availableOnly ? " | Available" : ""}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
                gap: 20,
              }}
            >
              {filtered.map((tailor) => (
                <TailorCard key={tailor.id} tailor={tailor} onHire={setSelectedTailor} />
              ))}
              {filtered.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "54px 20px",
                    background: palette.panel,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 24,
                    color: palette.muted,
                  }}
                >
                  <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: palette.text, margin: "0 0 8px" }}>
                    No workers match the current filters
                  </p>
                  <p style={{ margin: 0, fontSize: 14 }}>Try adjusting the search term or skill selection.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "jobs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>
                Open opportunities
              </p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: 0, color: palette.text }}>
                Browse available jobs
              </h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>
                Short-term work requests and assignment-based hiring briefs.
              </p>
            </div>
            {postedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        {activeTab === "post" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ marginBottom: 24, textAlign: "center" }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: palette.accent, textTransform: "uppercase", margin: "0 0 6px" }}>
                Reach skilled workers
              </p>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: 0, color: palette.text }}>
                Post a job
              </h2>
              <p style={{ fontSize: 14, color: palette.muted, marginTop: 8 }}>
                Describe the assignment, budget, and expected output.
              </p>
            </div>
            <div
              style={{
                background: palette.panel,
                borderRadius: 28,
                padding: "28px 24px",
                border: `1px solid ${palette.border}`,
                boxShadow: "0 12px 28px rgba(35,49,79,0.05)",
              }}
            >
              {jobPosted && (
                <div
                  style={{
                    background: palette.successSoft,
                    border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 14,
                    padding: "12px 16px",
                    marginBottom: 20,
                    fontSize: 14,
                    color: palette.success,
                    fontWeight: 700,
                  }}
                >
                  Job posted successfully. Workers can now discover it.
                </div>
              )}
              {[
                { label: "Job Title", key: "title", type: "text", placeholder: "e.g. Bridal Lehenga Embroidery" },
                { label: "Required Skill", key: "skill", type: "select" },
                { label: "Budget", key: "budget", type: "text", placeholder: "e.g. Rs. 500-800 or negotiable" },
                {
                  label: "Project Description",
                  key: "description",
                  type: "textarea",
                  placeholder: "Describe the garment, quantity, deadline, and any specific requirements...",
                },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: palette.text, display: "block", marginBottom: 6 }}>
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={postForm[field.key]}
                      onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      {SKILLS.filter((skill) => skill !== "All").map((skill) => (
                        <option key={skill}>{skill}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={postForm[field.key]}
                      onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      rows={4}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={postForm[field.key]}
                      onChange={(event) => setPostForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              <button
                onClick={handlePostJob}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: palette.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Post Job to 320+ Workers
              </button>
            </div>
          </div>
        )}
      </section>

      <HireModal tailor={selectedTailor} onClose={() => setSelectedTailor(null)} />
    </main>
  );
}





