import { cn } from "@/lib/utils";
import { getScoreClasses } from "@/lib/color-utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const colorClasses = getScoreClasses(score);
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
