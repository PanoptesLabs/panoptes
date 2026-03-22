"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, AlertTriangle, CheckCircle } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import type { SloItem } from "@/types";

interface SloCardProps {
  slo: SloItem;
}

function getBudgetColor(consumed: number | null): string {
  if (consumed === null) return "bg-slate-DEFAULT";
  if (consumed >= 100) return "bg-rose-DEFAULT";
  if (consumed >= 80) return "bg-amber-DEFAULT";
  return "bg-teal-DEFAULT";
}

function getStatusInfo(slo: SloItem) {
  if (!slo.isActive) {
    return { label: "Inactive", classes: "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30", icon: Target };
  }
  if (slo.budgetConsumed !== null && slo.budgetConsumed >= 100) {
    return { label: "Budget Exhausted", classes: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30", icon: AlertTriangle };
  }
  if (slo.isBreaching) {
    return { label: "Breaching", classes: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30", icon: AlertTriangle };
  }
  return { label: "Healthy", classes: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30", icon: CheckCircle };
}

export function SloCard({ slo }: SloCardProps) {
  const status = getStatusInfo(slo);
  const budgetWidth = slo.budgetConsumed !== null ? Math.min(slo.budgetConsumed, 100) : 0;

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-medium text-mist">
              {slo.name}
            </CardTitle>
            <p className="mt-1 text-xs text-dusty-lavender/50">
              {slo.entityType} &middot; {slo.indicator}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              status.classes,
            )}
          >
            <status.icon className="size-3" />
            {status.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Target vs Current */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-dusty-lavender/60">
              Target
              <HelpTooltip content={helpContent.slos.concepts.target} side="top" />
            </p>
            <p className="font-mono text-sm font-medium text-mist">
              {(slo.target * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/60">
              Current
            </p>
            <p className="font-mono text-sm font-medium text-mist">
              {slo.currentValue !== null ? `${(slo.currentValue * 100).toFixed(2)}%` : "--"}
            </p>
          </div>
        </div>

        {/* Error budget bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-dusty-lavender/60">
              Error Budget
              <HelpTooltip content={helpContent.slos.concepts.errorBudget} side="top" />
            </span>
            <span className="font-mono font-medium text-mist">
              {slo.budgetConsumed !== null ? `${slo.budgetConsumed.toFixed(1)}%` : "--"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-dark/50">
            <div
              className={cn("h-full rounded-full transition-all", getBudgetColor(slo.budgetConsumed))}
              style={{ width: `${budgetWidth}%` }}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-dusty-lavender/60">
          <span className="flex items-center gap-1">
            {slo.windowDays}d window
            <HelpTooltip content={helpContent.slos.concepts.windowDays} side="top" />
          </span>
          <span>
            {slo.lastEvaluatedAt ? `Evaluated ${timeAgo(slo.lastEvaluatedAt)}` : "Not evaluated"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
