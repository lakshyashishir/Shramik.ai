import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/language";

/* ─── Tier config (mirrors PassportCard) ─────────────────────── */
const TIERS = [
  { key: "bronze",   min: 0,   color: "#cd7f32", bg: "rgba(205,127,50,0.12)",  border: "rgba(205,127,50,0.35)",  label: "Bronze",   labelHi: "Bronze" },
  { key: "silver",   min: 300, color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)", label: "Silver",   labelHi: "Silver" },
  { key: "gold",     min: 600, color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)",  label: "Gold",     labelHi: "Gold" },
  { key: "platinum", min: 800, color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", label: "Platinum", labelHi: "Platinum" },
];

function getTier(karma) {
  if (karma >= 800) return TIERS[3];
  if (karma >= 600) return TIERS[2];
  if (karma >= 300) return TIERS[1];
  return TIERS[0];
}

/* ─── KarmaBadge ─────────────────────────────────────────────── */
/**
 * Reusable karma ring + tier pill component.
 *
 * Props:
 *   karma  {number}  0–1000  (defaults to 0)
 *   size   {"sm"|"md"|"lg"}  (defaults to "md")
 *   showTier  {boolean}  show tier pill below ring (defaults to true)
 *   dark   {boolean}  use dark background text colours (defaults to false)
 */
export default function KarmaBadge({ karma = 0, size = "md", showTier = true, dark = false }) {
  const { locale } = useLanguage();
  const tier = getTier(karma);

  const dim = { sm: 56, md: 80, lg: 104 }[size] ?? 80;
  const stroke = { sm: 5, md: 7, lg: 9 }[size] ?? 7;
  const fontSize = { sm: 13, md: 18, lg: 24 }[size] ?? 18;
  const labelSize = { sm: 7, md: 9, lg: 11 }[size] ?? 9;

  const radius = dim / 2;
  const norm = radius - stroke / 2;
  const circ = 2 * Math.PI * norm;

  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(karma), 120);
    return () => clearTimeout(t);
  }, [karma]);

  const offset = circ - (drawn / 1000) * circ;
  const textColor = dark ? "rgba(255,255,255,0.9)" : tier.color;
  const mutedColor = dark ? "rgba(255,255,255,0.4)" : "rgba(35,49,79,0.35)";
  const trackColor = dark ? "rgba(255,255,255,0.07)" : "rgba(35,49,79,0.07)";
  const tierLabel = locale === "hi" ? tier.labelHi : tier.label;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Ring */}
      <div style={{ position: "relative", width: dim, height: dim, flexShrink: 0 }}>
        <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={radius} cy={radius} r={norm} fill="none" stroke={trackColor} strokeWidth={stroke} />
          <circle
            cx={radius} cy={radius} r={norm}
            fill="none" stroke={tier.color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize, fontWeight: 800, color: textColor, lineHeight: 1 }}>
            {Math.round(drawn)}
          </span>
          <span style={{ fontSize: labelSize, color: mutedColor, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
            karma
          </span>
        </div>
      </div>

      {/* Tier pill */}
      {showTier && (
        <span style={{
          fontSize: labelSize + 1,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          padding: "3px 10px",
          borderRadius: 999,
          background: tier.bg,
          border: `1px solid ${tier.border}`,
          color: tier.color,
          whiteSpace: "nowrap",
        }}>
          {tierLabel}
        </span>
      )}
    </div>
  );
}
