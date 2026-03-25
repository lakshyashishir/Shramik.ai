import { createContext, useContext, useEffect, useMemo, useState } from "react";

/* ─── Centralised i18n strings ───────────────────────────────── */
export const STRINGS = {
  en: {
    // Onboarding
    "onboarding.welcome":  "Welcome! Tell us your name and trade.",
    "onboarding.confirm":  "Your name {name} has been registered.",
    "onboarding.start":    "Ready to start your interview?",

    // Interview room
    "interview.listening":    "Listening...",
    "interview.processing":   "Processing your answer...",
    "interview.photo_prompt": "Upload a photo of your work.",

    // Skill Passport tiers
    "passport.tier.bronze":   "Bronze",
    "passport.tier.silver":   "Silver",
    "passport.tier.gold":     "Gold",
    "passport.tier.platinum": "Platinum",
    "passport.karma":         "Karma Score",
    "passport.share":         "Share Passport",

    // Errors / fallbacks
    "error.voice_unavailable": "Voice unavailable. Type here.",
    "error.photo_failed":      "Photo upload failed. Try again.",

    // Admin / review
    "admin.override":        "Override AI Decision",
    "admin.review_pending":  "Pending Review",
  },
  hi: {
    // Onboarding
    "onboarding.welcome":  "Namaste! Apna naam aur kaam batayein.",
    "onboarding.confirm":  "Aapka naam {name} register ho gaya.",
    "onboarding.start":    "Interview shuru karein?",

    // Interview room
    "interview.listening":    "Sun raha hun...",
    "interview.processing":   "Aapka jawab sun raha hun...",
    "interview.photo_prompt": "Apne kaam ki photo bhejiye.",

    // Skill Passport tiers
    "passport.tier.bronze":   "Bronze",
    "passport.tier.silver":   "Silver",
    "passport.tier.gold":     "Gold",
    "passport.tier.platinum": "Platinum",
    "passport.karma":         "Karma Score",
    "passport.share":         "Passport share karein",

    // Errors / fallbacks
    "error.voice_unavailable": "Voice kaam nahi kar raha. Yahan type karein.",
    "error.photo_failed":      "Photo upload nahi hua. Dobara try karein.",

    // Admin / review
    "admin.override":       "Override karein",
    "admin.review_pending": "Review baaki hai",
  },
};

const STORAGE_KEY = "shramik.ai.locale";
const DEFAULT_LOCALE = "hi";
const SUPPORTED_LOCALES = ["en", "hi"];
const LocaleContext = createContext(null);

function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LOCALE;
    }

    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (nextLocale) => setLocaleState(normalizeLocale(nextLocale)),
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}

/* ─── Translation helper ─────────────────────────────────────── */
// Usage:  const t = useT();
//         t("onboarding.welcome")
//         t("onboarding.confirm", { name: "Ramesh" })
export function useT() {
  const { locale } = useLanguage();
  const strings = STRINGS[locale] ?? STRINGS.en;

  return (key, vars = {}) => {
    let str = strings[key] ?? STRINGS.en[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
    return str;
  };
}
