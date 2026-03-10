import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30";
  if (score >= 80) return "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30";
  if (score >= 60) return "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30";
  if (score >= 40) return "bg-orange-900/50 text-orange-300 border-orange-500/30";
  return "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const colorClasses = getScoreColor(score);
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono font-medium",
        colorClasses,
        sizeClasses,
      )}
    >
      {score !== null ? `${Math.round(score)}` : "--"}
    </span>
  );
}
