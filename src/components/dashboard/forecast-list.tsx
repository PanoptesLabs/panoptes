"use client";

import { useState } from "react";
import { useForecasts } from "@/hooks/use-forecasts";
import { ForecastCard } from "./forecast-card";
import { FilterSelect } from "./filter-select";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { TrendingUp, Loader2 } from "lucide-react";
import { Pagination } from "./pagination";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

const METRIC_OPTIONS = [
  { label: "All Metrics", value: "" },
  { label: "Latency", value: "latency" },
  { label: "Jail Risk", value: "jail_risk" },
  { label: "Downtime", value: "downtime" },
  { label: "Unbonding", value: "unbonding" },
  { label: "SLO Breach", value: "breach_risk" },
];

const ENTITY_TYPE_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Endpoint", value: "endpoint" },
  { label: "Validator", value: "validator" },
];

export function ForecastList() {
  const [metric, setMetric] = useState("");
  const [entityType, setEntityType] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 12;

  const { data, error, isLoading, mutate } = useForecasts({
    metric: metric || undefined,
    entityType: entityType || undefined,
    limit,
    offset,
  });

  if (error && !data) {
    return <ErrorState message="Failed to load forecasts" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1">
          <FilterSelect
            label="Metric"
            options={METRIC_OPTIONS}
            value={metric}
            onChange={(v) => { setMetric(v); setOffset(0); }}
          />
          {metric && helpContent.forecasts.metrics[metric as keyof typeof helpContent.forecasts.metrics] && (
            <HelpTooltip
              content={helpContent.forecasts.metrics[metric as keyof typeof helpContent.forecasts.metrics]}
              side="right"
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <FilterSelect
            label="Entity Type"
            options={ENTITY_TYPE_OPTIONS}
            value={entityType}
            onChange={(v) => { setEntityType(v); setOffset(0); }}
          />
          {entityType && helpContent.anomalies.entityTypes[entityType as keyof typeof helpContent.anomalies.entityTypes] && (
            <HelpTooltip
              content={helpContent.anomalies.entityTypes[entityType as keyof typeof helpContent.anomalies.entityTypes]}
              side="right"
            />
          )}
        </div>
      </div>

      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-soft-violet" />
        </div>
      )}

      {data && data.forecasts.length === 0 && (
        <EmptyState
          icon={<TrendingUp className="size-5 text-dusty-lavender/60" />}
          title="No forecasts available"
          description="Forecasts are generated automatically based on network metrics."
        />
      )}

      {data && data.forecasts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.forecasts.map((forecast: {
            id: string;
            entityType: string;
            entityId: string;
            metric: string;
            prediction: string;
            confidence: number;
            timeHorizon: string;
            currentValue: number;
            predictedValue: number;
            threshold: number | null;
            reasoning: string;
            validUntil: string;
            createdAt: string;
          }) => (
            <ForecastCard key={forecast.id} forecast={forecast} />
          ))}
        </div>
      )}

      {data && data.total > limit && (
        <Pagination total={data.total} limit={limit} offset={offset} onPageChange={setOffset} />
      )}
    </div>
  );
}
