import { useState, useEffect } from "react";

const SKILLS = ["All", "Bridal Wear", "Alterations", "Industrial Stitching", "Embroidery", "Leather Work", "Knitwear", "Suit Tailoring", "Children's Wear", "Pattern Making"];

const TAILORS = [
  {
    id: 1,
    name: "Priya Mehra",
    location: "Mumbai, India",
    specialization: "Bridal Wear",
    experience: 9,
    rating: 4.9,
    reviews: 142,
    hourlyRate: 18,
    skills: ["Bridal Wear", "Embroidery", "Pattern Making"],
    bio: "Crafting heirloom-quality bridal pieces with intricate zardozi embroidery for over 9 years.",
    available: true,
    completedJobs: 318,
    avatar: "PM",
    color: "#C8845A",
  },
  {
    id: 2,
    name: "James Okafor",
    location: "Lagos, Nigeria",
    specialization: "Suit Tailoring",
    experience: 14,
    rating: 4.8,
    reviews: 203,
    hourlyRate: 22,
    skills: ["Suit Tailoring", "Alterations", "Leather Work"],
    bio: "Bespoke suiting specialist trained in Savile Row tradition, now bringing that craft to modern West African fashion.",
    available: true,
    completedJobs: 540,
    avatar: "JO",
    color: "#4A7C8E",
  },
  {
    id: 3,
    name: "Sofia Reyes",
    location: "Barcelona, Spain",
    specialization: "Knitwear",
    experience: 6,
    rating: 4.7,
    reviews: 89,
    hourlyRate: 20,
    skills: ["Knitwear", "Children's Wear", "Alterations"],
    bio: "Specializing in sustainable knitted garments using natural fibers. Slow fashion advocate.",
    available: false,
    completedJobs: 176,
    avatar: "SR",
    color: "#7A6E9E",
  },
  {
    id: 4,
    name: "Aiko Tanaka",
    location: "Kyoto, Japan",
    specialization: "Pattern Making",
    experience: 11,
    rating: 5.0,
    reviews: 67,
    hourlyRate: 28,
    skills: ["Pattern Making", "Bridal Wear", "Embroidery"],
    bio: "Master pattern drafter blending traditional kimono construction methods with contemporary silhouettes.",
    available: true,
    completedJobs: 214,
    avatar: "AT",
    color: "#8E4A5A",
  },
  {
    id: 5,
    name: "Carlos Vega",
    location: "Mexico City, Mexico",
    specialization: "Leather Work",
    experience: 17,
    rating: 4.9,
    reviews: 311,
    hourlyRate: 25,
    skills: ["Leather Work", "Industrial Stitching", "Alterations"],
    bio: "Third-generation leatherworker crafting jackets, belts, and accessories with artisanal precision.",
    available: true,
    completedJobs: 892,
    avatar: "CV",
    color: "#6B7A3E",
  },
  {
    id: 6,
    name: "Amara Diallo",
    location: "Dakar, Senegal",
    specialization: "Embroidery",
    experience: 8,
    rating: 4.8,
    reviews: 124,
    hourlyRate: 15,
    skills: ["Embroidery", "Bridal Wear", "Children's Wear"],
    bio: "Breathing life into fabric through traditional Senegalese embroidery patterns and bold West African prints.",
    available: true,
    completedJobs: 289,
    avatar: "AD",
    color: "#C87A2E",
  },
  {
    id: 7,
    name: "Lars Eriksson",
    location: "Stockholm, Sweden",
    specialization: "Industrial Stitching",
    experience: 12,
    rating: 4.6,
    reviews: 58,
    hourlyRate: 30,
    skills: ["Industrial Stitching", "Knitwear", "Suit Tailoring"],
    bio: "Industrial-scale precision meets Scandinavian minimalism. Specializing in workwear and outerwear production.",
    available: false,
    completedJobs: 420,
    avatar: "LE",
    color: "#3E6B7A",
  },
  {
    id: 8,
    name: "Nisha Patel",
    location: "Ahmedabad, India",
    specialization: "Children's Wear",
    experience: 5,
    rating: 4.7,
    reviews: 93,
    hourlyRate: 12,
    skills: ["Children's Wear", "Alterations", "Embroidery"],
    bio: "Making the most adorable, durable, and safe garments for little ones aged 0–12 years.",
    available: true,
    completedJobs: 197,
    avatar: "NP",
    color: "#9E6B4A",
  },
];

const JOBS = [
  { id: 1, title: "Bridal Lehenga Embroidery", budget: "$200–400", skill: "Embroidery", postedAgo: "2h", urgent: true },
  { id: 2, title: "10 Suit Alterations (Corporate)", budget: "$150", skill: "Alterations", postedAgo: "5h", urgent: false },
  { id: 3, title: "Pattern Making — SS25 Collection", budget: "$500–800", skill: "Pattern Making", postedAgo: "1d", urgent: false },
  { id: 4, title: "Leather Jacket Repair & Restoration", budget: "$80–120", skill: "Leather Work", postedAgo: "3h", urgent: true },
  { id: 5, title: "Children's School Uniform × 30 pcs", budget: "$300", skill: "Children's Wear", postedAgo: "2d", urgent: false },
];

function StarRating({ rating }) {
  return (
    <span style={{ letterSpacing: 1, fontSize: 13, color: "#C8845A" }}>
      {"★".repeat(Math.floor(rating))}
      {rating % 1 >= 0.5 ? "½" : ""}
      <span style={{ color: "#CCC5B5", marginLeft: 5, fontFamily: "Georgia, serif", fontSize: 12 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function TailorCard({ tailor, onHire }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFDF7",
        border: `1.5px solid ${hovered ? tailor.color : "#E8E0D0"}`,
        borderRadius: 16,
        padding: "24px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "default",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered ? `0 8px 32px ${tailor.color}22` : "0 2px 12px #00000008",
        transform: hovered ? "translateY(-3px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative corner */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 60, height: 60,
        background: `${tailor.color}12`,
        borderRadius: "0 16px 0 60px",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${tailor.color}22`,
          border: `2px solid ${tailor.color}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700, fontSize: 17,
          color: tailor.color, flexShrink: 0,
          letterSpacing: 1,
        }}>
          {tailor.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 17, fontWeight: 700,
              color: "#2C1810", margin: 0,
            }}>{tailor.name}</h3>
            <span style={{
              display: "inline-block", fontSize: 10, fontWeight: 700,
              letterSpacing: 1.2, textTransform: "uppercase",
              padding: "2px 8px", borderRadius: 20,
              background: tailor.available ? "#D4EDDA" : "#F8D7D7",
              color: tailor.available ? "#2D6A4F" : "#A33",
            }}>
              {tailor.available ? "Available" : "Busy"}
            </span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8A7060" }}>
            📍 {tailor.location} · {tailor.experience}y exp
          </p>
        </div>
      </div>

      {/* Rating */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <StarRating rating={tailor.rating} />
        <span style={{ fontSize: 12, color: "#9A8870" }}>({tailor.reviews} reviews)</span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#5A4A3A", fontWeight: 600 }}>
          ${tailor.hourlyRate}/hr
        </span>
      </div>

      {/* Bio */}
      <p style={{
        fontSize: 13, color: "#6A5A4A", lineHeight: 1.6,
        margin: 0,
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
      }}>
        "{tailor.bio}"
      </p>

      {/* Skills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tailor.skills.map(skill => (
          <span key={skill} style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
            padding: "3px 10px", borderRadius: 20,
            background: `${tailor.color}18`,
            border: `1px solid ${tailor.color}44`,
            color: tailor.color,
          }}>{skill}</span>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px dashed #E0D8C8", paddingTop: 12, marginTop: 2,
      }}>
        <span style={{ fontSize: 12, color: "#9A8870" }}>
          🧵 {tailor.completedJobs} jobs done
        </span>
        <button
          onClick={() => onHire(tailor)}
          disabled={!tailor.available}
          style={{
            padding: "7px 20px",
            borderRadius: 30,
            border: "none",
            background: tailor.available ? tailor.color : "#D0C8B8",
            color: tailor.available ? "#fff" : "#8A8070",
            fontSize: 13, fontWeight: 700,
            cursor: tailor.available ? "pointer" : "not-allowed",
            fontFamily: "'Playfair Display', Georgia, serif",
            letterSpacing: 0.5,
            transition: "opacity 0.15s",
          }}
        >
          {tailor.available ? "Hire Now" : "Unavailable"}
        </button>
      </div>
    </div>
  );
}

function JobCard({ job }) {
  return (
    <div style={{
      background: "#FFFDF7",
      border: "1.5px solid #E8E0D0",
      borderLeft: `4px solid ${job.urgent ? "#C8845A" : "#7A9E7E"}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{
          margin: 0, fontSize: 14, fontWeight: 700,
          fontFamily: "'Playfair Display', Georgia, serif",
          color: "#2C1810", flex: 1,
        }}>{job.title}</h4>
        {job.urgent && (
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            padding: "2px 7px", borderRadius: 10,
            background: "#FDEBD0", color: "#C8845A", textTransform: "uppercase",
          }}>Urgent</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, padding: "2px 9px", borderRadius: 20,
          background: "#EDF5EE", color: "#4A7A5A", fontWeight: 600,
        }}>{job.skill}</span>
        <span style={{ fontSize: 12, color: "#8A7060", marginLeft: "auto" }}>💰 {job.budget}</span>
        <span style={{ fontSize: 11, color: "#AAA" }}>· {job.postedAgo} ago</span>
      </div>
    </div>
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
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(30,18,10,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFDF7",
          borderRadius: 20,
          padding: "32px 28px",
          width: "100%", maxWidth: 460,
          boxShadow: "0 24px 80px #00000033",
          border: "1.5px solid #E8E0D0",
          position: "relative",
        }}
      >
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 18,
          background: "none", border: "none",
          fontSize: 22, cursor: "pointer", color: "#8A7060",
        }}>×</button>

        {!sent ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C8845A", margin: "0 0 4px" }}>Hire Request</p>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: "#2C1810", margin: 0 }}>
                Contact {tailor.name}
              </h2>
              <p style={{ fontSize: 12.5, color: "#8A7060", marginTop: 4 }}>
                {tailor.specialization} · ${tailor.hourlyRate}/hr
              </p>
            </div>

            {[
              { label: "Your Name", key: "name", type: "text", placeholder: "Full name" },
              { label: "Email", key: "email", type: "email", placeholder: "your@email.com" },
              { label: "Project Details", key: "project", type: "textarea", placeholder: "Describe what you need..." },
              { label: "Preferred Start Date", key: "date", type: "date", placeholder: "" },
              { label: "Budget (USD)", key: "budget", type: "text", placeholder: "e.g. $150–300" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#5A4A3A", letterSpacing: 0.5, display: "block", marginBottom: 5 }}>
                  {field.label}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={form[field.key]}
                    onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}

            <button onClick={handleSubmit} style={{
              width: "100%", padding: "12px",
              background: tailor.color, color: "#fff",
              border: "none", borderRadius: 30,
              fontSize: 15, fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              cursor: "pointer", letterSpacing: 0.5, marginTop: 4,
            }}>
              Send Hire Request →
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧵</div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: "#2C1810", margin: "0 0 8px" }}>
              Request Sent!
            </h2>
            <p style={{ fontSize: 13.5, color: "#6A5A4A", lineHeight: 1.6 }}>
              {tailor.name} will be notified of your hire request and typically responds within 2–4 hours.
            </p>
            <button onClick={onClose} style={{
              marginTop: 20, padding: "10px 28px",
              background: tailor.color, color: "#fff",
              border: "none", borderRadius: 30,
              fontSize: 14, fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              cursor: "pointer",
            }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px",
  border: "1.5px solid #E0D8C8",
  borderRadius: 10, fontSize: 13.5,
  background: "#FEFAF4", color: "#2C1810",
  outline: "none", boxSizing: "border-box",
  fontFamily: "Georgia, serif",
  resize: "vertical",
};

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

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const filtered = TAILORS
    .filter(t => activeSkill === "All" || t.skills.includes(activeSkill))
    .filter(t => !availableOnly || t.available)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.location.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "rating" ? b.rating - a.rating : sortBy === "rate_asc" ? a.hourlyRate - b.hourlyRate : b.hourlyRate - a.hourlyRate);

  const handlePostJob = () => {
    if (!postForm.title || !postForm.description) return;
    const newJob = {
      id: Date.now(), title: postForm.title,
      budget: postForm.budget || "Open",
      skill: postForm.skill,
      postedAgo: "Just now", urgent: false,
    };
    setPostedJobs(p => [newJob, ...p]);
    setJobPosted(true);
    setPostForm({ title: "", skill: "Alterations", budget: "", description: "" });
    setTimeout(() => setJobPosted(false), 3000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F5F0E8",
      fontFamily: "Georgia, serif",
      color: "#2C1810",
    }}>
      {/* Header */}
      <header style={{
        background: "#2C1810",
        color: "#F5F0E8",
        padding: "0 20px",
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "3px solid #C8845A",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap",
          gap: 10, padding: "14px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🧵</span>
            <div>
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(18px, 4vw, 26px)",
                fontWeight: 700, margin: 0, letterSpacing: -0.5,
              }}>ThreadWork</h1>
              <p style={{ margin: 0, fontSize: 11, color: "#C8A882", letterSpacing: 1.5, textTransform: "uppercase" }}>
                Artisan Tailor Marketplace
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["tailors", "jobs", "post"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 30,
                  border: `1.5px solid ${activeTab === tab ? "#C8845A" : "#4A3020"}`,
                  background: activeTab === tab ? "#C8845A" : "transparent",
                  color: activeTab === tab ? "#fff" : "#C8A882",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Playfair Display', Georgia, serif",
                  textTransform: "capitalize",
                  transition: "all 0.2s",
                }}
              >{tab === "post" ? "Post a Job" : tab === "jobs" ? "Browse Jobs" : "Find Tailors"}</button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      {activeTab === "tailors" && (
        <div style={{
          background: "linear-gradient(135deg, #2C1810 0%, #4A2C18 50%, #3A2010 100%)",
          color: "#F5F0E8",
          padding: "clamp(32px, 6vw, 60px) 20px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative texture lines */}
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: `${10 + i * 12}%`, left: "-5%",
              width: "110%", height: 1,
              background: "rgba(200,132,90,0.08)",
              transform: `rotate(${-2 + i * 0.5}deg)`,
              pointerEvents: "none",
            }} />
          ))}
          <p style={{ fontSize: 11, letterSpacing: 3, color: "#C8845A", textTransform: "uppercase", margin: "0 0 10px" }}>
            Hand-picked Craft Professionals
          </p>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(26px, 6vw, 52px)",
            fontWeight: 700, margin: "0 0 14px",
            lineHeight: 1.15,
          }}>
            Hire Skilled Tailors<br />
            <em style={{ color: "#C8845A" }}>for Any Garment</em>
          </h2>
          <p style={{ fontSize: "clamp(13px, 2.5vw, 16px)", color: "#C8A882", maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.7 }}>
            Connect with verified artisan tailors worldwide. From bridal couture to industrial production — find the perfect craft match.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {[["320+", "Active Tailors"], ["12K+", "Jobs Done"], ["4.8★", "Avg Rating"]].map(([num, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#C8845A", margin: 0 }}>{num}</p>
                <p style={{ fontSize: 11, color: "#9A7860", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 16px 60px" }}>

        {/* TAILORS TAB */}
        {activeTab === "tailors" && (
          <>
            {/* Filters */}
            <div style={{
              background: "#FFFDF7",
              borderRadius: 16, padding: "18px 20px",
              border: "1.5px solid #E8E0D0",
              marginBottom: 24,
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or location..."
                  style={{
                    ...inputStyle,
                    flex: "1 1 200px",
                    minWidth: 0,
                    padding: "9px 14px",
                  }}
                />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ ...inputStyle, flex: "0 0 auto", cursor: "pointer" }}
                >
                  <option value="rating">Sort: Top Rated</option>
                  <option value="rate_asc">Sort: Price ↑</option>
                  <option value="rate_desc">Sort: Price ↓</option>
                </select>
                <label style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, color: "#5A4A3A", cursor: "pointer",
                  padding: "9px 14px",
                  background: availableOnly ? "#D4EDDA" : "#F5F0E8",
                  borderRadius: 10, border: "1.5px solid #E0D8C8",
                  fontWeight: availableOnly ? 700 : 400,
                  transition: "all 0.2s",
                }}>
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={e => setAvailableOnly(e.target.checked)}
                    style={{ accentColor: "#2D6A4F" }}
                  />
                  Available only
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => setActiveSkill(skill)}
                    style={{
                      padding: "5px 14px", borderRadius: 20,
                      border: `1.5px solid ${activeSkill === skill ? "#C8845A" : "#E0D8C8"}`,
                      background: activeSkill === skill ? "#C8845A" : "#FEFAF4",
                      color: activeSkill === skill ? "#fff" : "#6A5A4A",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >{skill}</button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <p style={{ fontSize: 12.5, color: "#9A8870", marginBottom: 16, fontStyle: "italic" }}>
              Showing {filtered.length} tailor{filtered.length !== 1 ? "s" : ""}
              {activeSkill !== "All" ? ` · ${activeSkill}` : ""}
              {availableOnly ? " · Available" : ""}
            </p>

            {/* Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
              gap: 20,
            }}>
              {filtered.map(tailor => (
                <TailorCard key={tailor.id} tailor={tailor} onHire={setSelectedTailor} />
              ))}
              {filtered.length === 0 && (
                <div style={{
                  gridColumn: "1 / -1",
                  textAlign: "center", padding: "60px 20px",
                  color: "#9A8870",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧵</div>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18 }}>No tailors match your filters</p>
                  <p style={{ fontSize: 13 }}>Try adjusting your search or skill filter</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* JOBS TAB */}
        {activeTab === "jobs" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: "#C8845A", textTransform: "uppercase", margin: "0 0 6px" }}>Open Opportunities</p>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(22px, 4vw, 34px)", margin: 0, color: "#2C1810" }}>
                Browse Available Jobs
              </h2>
              <p style={{ fontSize: 13.5, color: "#8A7060", marginTop: 6 }}>Jobs posted by clients looking for skilled tailors</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {postedJobs.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          </>
        )}

        {/* POST JOB TAB */}
        {activeTab === "post" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ marginBottom: 28, textAlign: "center" }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: "#C8845A", textTransform: "uppercase", margin: "0 0 6px" }}>Reach 320+ Tailors</p>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(22px, 4vw, 34px)", margin: 0 }}>
                Post a Job
              </h2>
              <p style={{ fontSize: 13.5, color: "#8A7060", marginTop: 8 }}>Describe your project and let tailors come to you</p>
            </div>
            <div style={{
              background: "#FFFDF7",
              borderRadius: 20, padding: "28px 24px",
              border: "1.5px solid #E8E0D0",
              boxShadow: "0 4px 24px #00000008",
            }}>
              {jobPosted && (
                <div style={{
                  background: "#D4EDDA", border: "1.5px solid #A8D5B0",
                  borderRadius: 12, padding: "12px 16px",
                  marginBottom: 20, fontSize: 14, color: "#2D6A4F",
                  fontWeight: 600,
                }}>
                  ✓ Job posted successfully! Tailors will be notified.
                </div>
              )}
              {[
                { label: "Job Title *", key: "title", type: "text", placeholder: "e.g. Bridal Lehenga Embroidery" },
                { label: "Required Skill *", key: "skill", type: "select" },
                { label: "Budget (USD)", key: "budget", type: "text", placeholder: "e.g. $150–300 or Negotiable" },
                { label: "Project Description *", key: "description", type: "textarea", placeholder: "Describe the garment, quantity, deadline, and any specific requirements..." },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#5A4A3A", letterSpacing: 0.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={postForm[field.key]}
                      onChange={e => setPostForm(p => ({ ...p, [field.key]: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      {SKILLS.filter(s => s !== "All").map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={postForm[field.key]}
                      onChange={e => setPostForm(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={4}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={postForm[field.key]}
                      onChange={e => setPostForm(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              <button onClick={handlePostJob} style={{
                width: "100%", padding: "13px",
                background: "#2C1810", color: "#F5F0E8",
                border: "none", borderRadius: 30,
                fontSize: 16, fontWeight: 700,
                fontFamily: "'Playfair Display', Georgia, serif",
                cursor: "pointer", letterSpacing: 0.5,
                transition: "background 0.2s",
              }}>
                Post Job to 320+ Tailors →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: "#2C1810", color: "#C8A882",
        textAlign: "center", padding: "20px",
        fontSize: 12, borderTop: "3px solid #C8845A",
      }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#C8845A" }}>ThreadWork</span>
        {" "}· Artisan Tailor Marketplace · Connecting Craft Worldwide
      </footer>

      <HireModal tailor={selectedTailor} onClose={() => setSelectedTailor(null)} />
    </div>
  );
}
