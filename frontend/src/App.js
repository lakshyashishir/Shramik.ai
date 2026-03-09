import "@/App.css";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import LandingPage from "@/pages/LandingPage";
import ScreeningRoomPage from "@/pages/ScreeningRoomPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import TailorBoard from "@pages/WorkersBoardPage";
import { Toaster } from "@/components/ui/sonner";

const navLinks = [
  { path: "/", label: "Home" },
  { path: "/screening", label: "Live Screening" },
  { path: "/admin", label: "Operations" },
  { path: "/jobs", label: "Job Board" },
];

function MainNavigation() {
  return (
    <nav className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            S
          </span>
          <div>
            <p className="font-heading text-xl leading-none">Shramik.ai</p>
            <p className="text-xs text-muted-foreground">Tailoring Skill Assessment</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/10 hover:text-accent"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <MainNavigation />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/screening" element={<ScreeningRoomPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Routes>
        </div>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
