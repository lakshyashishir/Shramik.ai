import "@/App.css";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import ScreeningRoomPage from "@/pages/ScreeningRoomPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import WorkersBoardPage from "@/pages/WorkersBoardPage";
import ReviewQueuePage from "@/pages/ReviewQueuePage";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider, useLanguage } from "@/i18n/language";
import { ROLES, RoleProvider, roleConfig, useRole } from "@/context/role";

export { useRole };

/* ─── Copy ───────────────────────────────────────────────────── */
const appCopy = {
  en: {
    subtitle: "Live skill assessment platform",
    nav: { home: "Home", screening: "Live Screening", admin: "Operations", jobs: "Job Board", review: "Review Queue" },
    locale: { label: "Language", en: "English", hi: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  },
  hi: {
    subtitle: "\u0932\u093e\u0907\u0935 \u0938\u094d\u0915\u093f\u0932 \u0905\u0938\u0947\u0938\u092e\u0947\u0902\u091f \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e",
    nav: {
      home: "\u0939\u094b\u092e",
      screening: "\u0932\u093e\u0907\u0935 \u0938\u094d\u0915\u094d\u0930\u0940\u0928\u093f\u0902\u0917",
      admin: "\u0911\u092a\u0930\u0947\u0936\u0928\u094d\u0938",
      jobs: "\u091c\u0949\u092c \u092c\u094b\u0930\u094d\u0921",
      review: "Review Queue",
    },
    locale: { label: "\u092d\u093e\u0937\u093e", en: "English", hi: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  },
};

const allNavLinks = (copy) => [
  { path: "/",             label: copy.nav.home },
  { path: "/screening",    label: copy.nav.screening },
  { path: "/admin",        label: copy.nav.admin },
  { path: "/admin/review", label: copy.nav.review },
  { path: "/jobs",         label: copy.nav.jobs },
];

/* ─── Role Toggle ─────────────────────────────────────────────── */
function RoleToggle({ compact = false }) {
  const { role, setRole } = useRole();
  const { locale } = useLanguage();
  const navigate = useNavigate();

  const handleRole = (r) => {
    setRole(r);
    // Auto-navigate to the primary page for that role
    const primary = { worker: "/screening", recruiter: "/jobs", admin: "/admin" }[r];
    navigate(primary);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      borderRadius: 999, border: "1px solid rgba(35,49,79,0.12)",
      background: "rgba(255,255,255,0.9)", padding: "3px",
    }}>
      {ROLES.map((r) => {
        const cfg = roleConfig[r];
        const active = role === r;
        const lbl = locale === "hi" ? cfg.labelHi : cfg.label;
        return (
          <button
            key={r}
            onClick={() => handleRole(r)}
            style={{
              padding: compact ? "4px 10px" : "5px 13px",
              borderRadius: 999, border: "none",
              background: active ? cfg.color : "transparent",
              color: active ? "#fff" : "rgba(35,49,79,0.55)",
              fontSize: compact ? 11 : 12,
              fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: 0.2,
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Language Toggle ─────────────────────────────────────────── */
export function LanguageToggle({ compact = false }) {
  const { locale, setLocale, supportedLocales } = useLanguage();
  const copy = appCopy[locale] ?? appCopy.en;

  return (
    <div className={`flex items-center gap-2 rounded-full border border-border/60 bg-background/90 p-1 ${compact ? "shadow-lg shadow-primary/10" : ""}`}>
      {!compact && <span className="px-2 text-xs font-medium text-muted-foreground">{copy.locale.label}</span>}
      {supportedLocales.map((localeCode) => (
        <button
          key={localeCode}
          onClick={() => setLocale(localeCode)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${locale === localeCode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10"}`}
        >
          {copy.locale[localeCode]}
        </button>
      ))}
    </div>
  );
}

/* ─── Navigation ──────────────────────────────────────────────── */
function MainNavigation() {
  const { locale } = useLanguage();
  const { role } = useRole();
  const copy = appCopy[locale] ?? appCopy.en;
  const cfg = roleConfig[role];

  // Only show nav links permitted for this role
  const navLinks = allNavLinks(copy).filter((link) => cfg.nav.includes(link.path));

  return (
    <nav className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ background: cfg.color }}
          >
            S
          </span>
          <div>
            <p className="font-heading text-xl leading-none">Shramik.ai</p>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>

        {/* Desktop nav + toggles */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                    isActive ? "text-white" : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
                  }`
                }
                style={({ isActive }) => isActive ? { background: cfg.color } : {}}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <RoleToggle />
          <LanguageToggle />
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex gap-2 overflow-x-auto px-6 pb-4 md:hidden">
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                isActive ? "text-white" : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
              }`
            }
            style={({ isActive }) => isActive ? { background: cfg.color } : {}}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ─── App Shell ───────────────────────────────────────────────── */
function AppShell() {
  const location = useLocation();
  const hideNavigation = location.pathname === "/screening";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNavigation && <MainNavigation />}
      <Routes>
        <Route path="/" element={<Navigate to="/screening" replace />} />
        <Route path="/screening" element={<ScreeningRoomPage />} />
        <Route path="/jobs" element={<WorkersBoardPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/review" element={<ReviewQueuePage />} />
      </Routes>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────────────── */
export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageProvider>
        <RoleProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </RoleProvider>
      </LanguageProvider>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
