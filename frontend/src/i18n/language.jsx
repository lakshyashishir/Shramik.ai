import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
