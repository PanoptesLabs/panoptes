export const colors = {
  // Core Identity
  midnightPlum: "#1C0F2B",
  deepIris: "#4C1D95",
  softViolet: "#8B5CF6",
  dustyLavender: "#C4B5FD",
  mist: "#EDE9FE",

  // Section Palette
  teal: { dark: "#134E4A", DEFAULT: "#0D9488", light: "#99F6E4" },
  rose: { dark: "#4C0519", DEFAULT: "#BE185D", light: "#FDA4AF" },
  amber: { dark: "#451A03", DEFAULT: "#D97706", light: "#FDE68A" },
  slate: { dark: "#0F172A", DEFAULT: "#475569", light: "#CBD5E1" },
  indigo: { dark: "#1E1B4B", DEFAULT: "#4338CA", light: "#A5B4FC" },
} as const;

export const fonts = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  mono: "var(--font-mono)",
} as const;
