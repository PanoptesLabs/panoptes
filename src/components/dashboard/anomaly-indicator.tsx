"use client";

import { useAnomalies } from "@/hooks/use-anomalies";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function AnomalyIndicator() {
  const { data } = useAnomalies({ resolved: false });

  const total = data?.total ?? 0;

  if (total === 0) return null;

  const hasCritical = data?.anomalies.some((a) => a.severity === "critical");
  const hasHigh = data?.anomalies.some((a) => a.severity === "high");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        hasCritical
          ? "border-rose-DEFAULT/30 bg-rose-dark/50 text-rose-light"
          : hasHigh
            ? "border-amber-DEFAULT/30 bg-amber-dark/50 text-amber-light"
            : "border-slate-DEFAULT/30 bg-slate-dark/50 text-slate-light",
      )}
    >
      <AlertTriangle className="size-3" />
      {total} {total === 1 ? "anomaly" : "anomalies"}
    </div>
  );
}
