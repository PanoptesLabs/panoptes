"use client";

import { useState } from "react";
import { useSloSummary } from "@/hooks/use-slos";
import { StatCard } from "./stat-card";
import { SloCard } from "./slo-card";
import { FilterSelect } from "./filter-select";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { Target, ShieldCheck, AlertTriangle, Ban } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

const INDICATOR_OPTIONS = [
  { label: "All Indicators", value: "" },
  { label: "Uptime", value: "uptime" },
  { label: "Latency", value: "latency" },
  { label: "Error Rate", value: "error_rate" },
  { label: "Block Production", value: "block_production" },
];

export function SloList() {
  const { data, error, isLoading, mutate } = useSloSummary();
  const [indicator, setIndicator] = useState("");

  if (error && !data) {
    return <ErrorState message="Failed to load SLOs" onRetry={() => mutate()} />;
  }

  const filteredSlos = data?.slos.filter(
    (s) => !indicator || s.indicator === indicator,
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total SLOs"
          value={data ? String(data.total) : "--"}
          subtitle={data ? `${data.active} active` : undefined}
          icon={<Target className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Healthy"
          value={data ? `${data.healthyPct.toFixed(1)}%` : "--"}
          subtitle="of active SLOs"
          icon={<ShieldCheck className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title={
            <span className="flex items-center gap-1">
              Breaching
              <HelpTooltip content={helpContent.slos.concepts.breaching} side="bottom" />
            </span>
          }
          value={data ? String(data.breaching) : "--"}
          subtitle="SLOs below target"
          icon={<AlertTriangle className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title={
            <span className="flex items-center gap-1">
              Budget Exhausted
              <HelpTooltip content={helpContent.slos.concepts.errorBudget} side="bottom" />
            </span>
          }
          value={data ? String(data.budgetExhausted) : "--"}
          subtitle="no remaining budget"
          icon={<Ban className="size-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <FilterSelect
          label="Indicator"
          options={INDICATOR_OPTIONS}
          value={indicator}
          onChange={setIndicator}
        />
        {indicator && helpContent.slos.indicators[indicator as keyof typeof helpContent.slos.indicators] && (
          <HelpTooltip
            content={helpContent.slos.indicators[indicator as keyof typeof helpContent.slos.indicators]}
            side="right"
          />
        )}
      </div>

      {/* Loading */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
        </div>
      )}

      {/* Empty state */}
      {data && filteredSlos.length === 0 && (
        <EmptyState
          icon={<Target className="size-5 text-dusty-lavender/40" />}
          title="No SLOs found"
          description="Service level objectives help you track and maintain reliability targets."
        />
      )}

      {/* SLO grid */}
      {filteredSlos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSlos.map((slo) => (
            <SloCard key={slo.id} slo={slo} />
          ))}
        </div>
      )}
    </div>
  );
}
