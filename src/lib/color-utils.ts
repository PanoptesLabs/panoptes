/**
 * Centralized color utility functions for consistent theming across components.
 */

/** Score-based color classes (0-100 scale) */
export function getScoreClasses(score: number | null): string {
  if (score === null) return "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30";
  if (score >= 80) return "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30";
  if (score >= 60) return "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30";
  if (score >= 40) return "bg-orange-900/50 text-orange-300 border-orange-500/30";
  return "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30";
}

/** Budget consumption color (progress bar bg) */
export function getBudgetClasses(consumed: number | null): string {
  if (consumed === null) return "bg-slate-DEFAULT";
  if (consumed >= 100) return "bg-rose-DEFAULT";
  if (consumed >= 80) return "bg-amber-DEFAULT";
  return "bg-teal-DEFAULT";
}

/** Prediction status config */
export const PREDICTION_CONFIG = {
  normal: {
    label: "Normal",
    classes: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30",
    iconColor: "text-teal-DEFAULT",
  },
  warning: {
    label: "Warning",
    classes: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
    iconColor: "text-amber-DEFAULT",
  },
  critical: {
    label: "Critical",
    classes: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
    iconColor: "text-rose-DEFAULT",
  },
} as const;

export type PredictionLevel = keyof typeof PREDICTION_CONFIG;

/** Severity → icon color mapping (for leading icons, not badges) */
export const SEVERITY_ICON_COLORS: Record<string, string> = {
  critical: "text-rose-DEFAULT",
  high: "text-amber-DEFAULT",
  medium: "text-orange-400",
  low: "text-dusty-lavender/50",
};
