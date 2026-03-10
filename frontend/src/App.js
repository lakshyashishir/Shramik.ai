import "@/App.css";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import LandingPage from "@/pages/LandingPage";
import ScreeningRoomPage from "@/pages/ScreeningRoomPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import WorkersBoardPage from "@/pages/WorkersBoardPage";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider, useLanguage } from "@/i18n/language";

const appCopy = {
  en: {
    subtitle: "Live skill assessment platform",
    nav: {
      home: "Home",
      screening: "Live Screening",
      admin: "Operations",
      jobs: "Job Board",
    },
    locale: {
      label: "Language",
      en: "English",
      hi: "\u0939\u093f\u0928\u094d\u0926\u0940",
    },
  },
  hi: {
    subtitle: "\u0932\u093e\u0907\u0935 \u0938\u094d\u0915\u093f\u0932 \u0905\u0938\u0947\u0938\u092e\u0947\u0902\u091f \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e",
    nav: {
      home: "\u0939\u094b\u092e",
      screening: "\u0932\u093e\u0907\u0935 \u0938\u094d\u0915\u094d\u0930\u0940\u0928\u093f\u0902\u0917",
      admin: "\u0911\u092a\u0930\u0947\u0936\u0928\u094d\u0938",
      jobs: "\u091c\u0949\u092c \u092c\u094b\u0930\u094d\u0921",
    },
    locale: {
      label: "\u092d\u093e\u0937\u093e",
      en: "English",
      hi: "\u0939\u093f\u0928\u094d\u0926\u0940",
    },
  },
};

function LanguageToggle({ compact = false }) {
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

function MainNavigation() {
  const { locale } = useLanguage();
  const copy = appCopy[locale] ?? appCopy.en;
  const navLinks = [
    { path: "/", label: copy.nav.home },
    { path: "/screening", label: copy.nav.screening },
    { path: "/admin", label: copy.nav.admin },
    { path: "/jobs", label: copy.nav.jobs },
  ];

  return (
    <nav className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">S</span>
          <div>
            <p className="font-heading text-xl leading-none">Shramik.ai</p>
            <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <LanguageToggle />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-6 pb-4 md:hidden">
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AppShell() {
  const location = useLocation();
  const hideNavigation = location.pathname === "/screening";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNavigation && <MainNavigation />}
      {hideNavigation && (
        <div className="fixed right-4 top-4 z-40">
          <LanguageToggle compact />
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/screening" element={<ScreeningRoomPage />} />
        <Route path="/jobs" element={<WorkersBoardPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </LanguageProvider>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
