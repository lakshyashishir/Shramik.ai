import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/language";
import { screeningApi } from "@/services/api";

/* ── Fallback data matching WorkerProfilePage ────────────────────── */
const FALLBACK_PROFILES = {
  demo_1: {
    worker_name: "Priya Mehra", specialization: "Bridal Wear", location: "Mumbai, India",
    experience_years: 9, hourly_rate: 950,
    bio: "Crafting heirloom-quality bridal pieces with intricate zardozi embroidery for over 9 years.",
    skills: ["Bridal Wear", "Embroidery", "Pattern Making"],
    available: true,
    portfolio_images: [
      { id: 1, url: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80", caption: "Zardozi panel — bridal lehenga" },
      { id: 2, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80", caption: "Hemline finish detail" },
      { id: 3, url: "https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=400&q=80", caption: "Mirror-work motif closeup" },
      { id: 4, url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80", caption: "Bridal lehenga — full piece" },
      { id: 5, url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80", caption: "Saree border embroidery" },
    ],
  },
  demo_2: {
    worker_name: "Nisha Patel", specialization: "Children's Wear", location: "Ahmedabad, India",
    experience_years: 5, hourly_rate: 720,
    bio: "Making durable and comfortable garments for children, school uniforms, and small-batch custom orders.",
    skills: ["Children's Wear", "Alterations", "Embroidery"],
    available: true,
    portfolio_images: [
      { id: 1, url: "https://images.unsplash.com/photo-1619086303291-0ef7699e4b31?w=400&q=80", caption: "School uniform — shirt detail" },
      { id: 2, url: "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&q=80", caption: "Children's kurta set" },
      { id: 3, url: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&q=80", caption: "Uniform batch — finished pieces" },
    ],
  },
};

const ALL_SKILLS = [
  "Bridal Wear", "Alterations", "Industrial Stitching", "Embroidery",
  "Leather Work", "Knitwear", "Suit Tailoring", "Children's Wear", "Pattern Making",
];

/* ── i18n copy ───────────────────────────────────────────────────── */
const COPY = {
  en: {
    back: "Back to Profile",
    pageTitle: "Edit Profile",
    pageSubtitle: "Your public profile is seen by recruiters and employers.",
    basicInfo: "Basic Information",
    name: "Full Name",
    specialization: "Specialization",
    location: "Location",
    experience: "Years of Experience",
    rate: "Hourly Rate (₹)",
    bio: "Bio",
    bioPlaceholder: "Describe your expertise, the kind of work you do, and what sets you apart...",
    skills: "Skills",
    availability: "Available for Work",
    availableYes: "Yes, currently available",
    availableNo: "Not available right now",
    portfolio: "Work Portfolio",
    portfolioSubtitle: "Upload photos of your best work. Recruiters can see these on your profile.",
    addPhoto: "Add Photo",
    dragDrop: "Drag & drop photos or click to upload",
    captionPlaceholder: "Describe this piece...",
    removePhoto: "Remove",
    save: "Save Changes",
    saving: "Saving...",
    saved: "Profile updated!",
    unsaved: "You have unsaved changes.",
    publicNote: "These changes will be visible on your public profile immediately.",
  },
  hi: {
    back: "Profile पर वापस जाएं",
    pageTitle: "Profile संपादित करें",
    pageSubtitle: "आपकी public profile recruiters और employers को दिखती है।",
    basicInfo: "बुनियादी जानकारी",
    name: "पूरा नाम",
    specialization: "Specialization",
    location: "शहर / स्थान",
    experience: "अनुभव (साल)",
    rate: "प्रति घंटा दर (₹)",
    bio: "अपने बारे में",
    bioPlaceholder: "अपने काम, expertise और खासियत के बारे में बताएं...",
    skills: "Skills",
    availability: "काम के लिए उपलब्धता",
    availableYes: "हाँ, अभी उपलब्ध हूं",
    availableNo: "अभी उपलब्ध नहीं",
    portfolio: "काम की तस्वीरें",
    portfolioSubtitle: "अपने बेहतरीन काम की तस्वीरें upload करें। Recruiters आपकी profile पर देख सकते हैं।",
    addPhoto: "तस्वीर जोड़ें",
    dragDrop: "Photos drag करें या click करके upload करें",
    captionPlaceholder: "इस काम के बारे में बताएं...",
    removePhoto: "हटाएं",
    save: "बदलाव सेव करें",
    saving: "सेव हो रहा है...",
    saved: "Profile update हो गई!",
    unsaved: "कुछ बदलाव सेव नहीं हुए।",
    publicNote: "यह बदलाव आपकी public profile पर तुरंत दिखेंगे।",
  },
};

const palette = {
  bg: "#f8fafc", panel: "#ffffff", border: "#dbe4f0",
  text: "#23314f", muted: "#64748b", accent: "#3b82f6",
  success: "#22c55e",
};

const inputStyle = {
  width: "100%", padding: "10px 14px",
  border: `1px solid ${palette.border}`, borderRadius: 12,
  fontSize: 14, background: palette.panel, color: palette.text,
  outline: "none", fontFamily: "Manrope, sans-serif",
  boxSizing: "border-box",
};

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 14px" }}>
      {children}
    </p>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 20, padding: "22px 22px", boxShadow: "0 4px 20px rgba(35,49,79,0.05)", ...style }}>
      {children}
    </div>
  );
}

/* ── Photo grid item ─────────────────────────────────────────────── */
function PhotoItem({ item, onRemove, onCaption, copy }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${palette.border}`, background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#e2e8f0" }}>
        {!imgError ? (
          <img src={item.url} alt={item.caption || ""} onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🧵</div>
        )}
        <button
          onClick={() => onRemove(item.id)}
          style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
          title={copy.removePhoto}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <input
          value={item.caption || ""}
          onChange={(e) => onCaption(item.id, e.target.value)}
          placeholder={copy.captionPlaceholder}
          style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, borderRadius: 8 }}
        />
      </div>
    </div>
  );
}

/* ── Upload drop zone ────────────────────────────────────────────── */
function UploadZone({ onFiles, copy }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef();
  const handle = (fileList) => {
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    onFiles(arr.map((f) => ({ id: Date.now() + Math.random(), url: URL.createObjectURL(f), caption: "" })));
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      onClick={() => ref.current?.click()}
      style={{
        border: `2px dashed ${dragging ? palette.accent : palette.border}`,
        borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer",
        background: dragging ? "rgba(59,130,246,0.04)" : "#f8fafc", transition: "all 0.2s",
      }}
    >
      <p style={{ fontSize: 24, margin: "0 0 6px" }}>📸</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: palette.text, margin: "0 0 4px" }}>{copy.addPhoto}</p>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{copy.dragDrop}</p>
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function WorkerEditProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const copy = COPY[locale] ?? COPY.en;

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fallback = FALLBACK_PROFILES[id];
    if (fallback) {
      setForm({ ...fallback });
      return;
    }
    // Try to load from API
    Promise.all([
      screeningApi.getPassport(id).catch(() => null),
      screeningApi.listWorkers().catch(() => []),
    ]).then(([passport, workers]) => {
      const worker = (workers || []).find((w) => w.id === id);
      if (passport || worker) {
        setForm({
          worker_name: passport?.worker_name ?? worker?.name ?? "",
          specialization: passport?.specialization ?? worker?.specialization ?? "",
          experience_years: passport?.experience_years ?? worker?.experience_years ?? 0,
          location: worker?.location ?? "",
          hourly_rate: worker?.hourlyRate ?? "",
          bio: worker?.bio ?? "",
          skills: worker?.skills ?? [],
          available: worker?.available ?? true,
          portfolio_images: [],
        });
      } else {
        navigate("/jobs");
      }
    });
  }, [id, navigate]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggleSkill = (skill) => {
    const skills = form.skills ?? [];
    update("skills", skills.includes(skill) ? skills.filter((s) => s !== skill) : [...skills, skill]);
  };

  const addPhotos = (newItems) => {
    update("portfolio_images", [...(form.portfolio_images ?? []), ...newItems]);
  };

  const removePhoto = (photoId) => {
    update("portfolio_images", (form.portfolio_images ?? []).filter((p) => p.id !== photoId));
  };

  const updateCaption = (photoId, caption) => {
    update("portfolio_images", (form.portfolio_images ?? []).map((p) => p.id === photoId ? { ...p, caption } : p));
  };

  const handleSave = () => {
    setSaving(true);
    // Simulate async save (no backend write for profile yet)
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    }, 900);
  };

  if (!form) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #dbe4f0", borderTopColor: palette.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(16px,4vw,32px) clamp(12px,3vw,20px) 80px", fontFamily: "Manrope, sans-serif", color: palette.text }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <button
          onClick={() => navigate(`/workers/${id}`)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: palette.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← {copy.back}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {dirty && !saved && (
            <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>{copy.unsaved}</span>
          )}
          {saved && (
            <span style={{ fontSize: 12, color: palette.success, fontWeight: 700 }}>✓ {copy.saved}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 22px", borderRadius: 999, border: "none",
              background: saving ? "#94a3b8" : palette.text,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.5rem,4vw,2rem)", margin: "0 0 6px" }}>{copy.pageTitle}</h1>
        <p style={{ fontSize: 14, color: palette.muted, margin: 0 }}>{copy.pageSubtitle}</p>
      </div>

      {/* ── Basic Info ──────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>{copy.basicInfo}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="edit-grid">
          <style>{`@media(max-width:520px){ .edit-grid{ grid-template-columns:1fr !important; } }`}</style>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.name}</label>
            <input value={form.worker_name ?? ""} onChange={(e) => update("worker_name", e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.specialization}</label>
            <input value={form.specialization ?? ""} onChange={(e) => update("specialization", e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.location}</label>
            <input value={form.location ?? ""} onChange={(e) => update("location", e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.experience}</label>
            <input type="number" min={0} max={50} value={form.experience_years ?? ""} onChange={(e) => update("experience_years", Number(e.target.value))} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.rate}</label>
            <input type="number" min={0} value={form.hourly_rate ?? ""} onChange={(e) => update("hourly_rate", Number(e.target.value))} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.availability}</label>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => update("available", val)}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${form.available === val ? palette.accent : palette.border}`,
                    background: form.available === val ? "rgba(59,130,246,0.08)" : palette.panel,
                    color: form.available === val ? palette.accent : palette.muted,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {val ? copy.availableYes : copy.availableNo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: palette.muted, display: "block", marginBottom: 6 }}>{copy.bio}</label>
          <textarea
            value={form.bio ?? ""}
            onChange={(e) => update("bio", e.target.value)}
            placeholder={copy.bioPlaceholder}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>
      </Card>

      {/* ── Skills ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>{copy.skills}</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ALL_SKILLS.map((skill) => {
            const active = (form.skills ?? []).includes(skill);
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                style={{
                  padding: "8px 16px", borderRadius: 999,
                  border: `1px solid ${active ? palette.accent : palette.border}`,
                  background: active ? palette.accent : palette.panel,
                  color: active ? "#fff" : palette.muted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Portfolio ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>{copy.portfolio}</SectionTitle>
        <p style={{ fontSize: 13, color: palette.muted, margin: "0 0 16px", lineHeight: 1.6 }}>{copy.portfolioSubtitle}</p>

        {(form.portfolio_images ?? []).length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {(form.portfolio_images).map((item) => (
              <PhotoItem key={item.id} item={item} onRemove={removePhoto} onCaption={updateCaption} copy={copy} />
            ))}
          </div>
        )}

        <UploadZone onFiles={addPhotos} copy={copy} />
      </Card>

      {/* ── Save footer note ────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: palette.muted, textAlign: "center", marginTop: 20 }}>
        🔒 {copy.publicNote}
      </p>
    </main>
  );
}
