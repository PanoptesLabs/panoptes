"use client";

import { useEndpoints } from "@/hooks/use-endpoints";
import { StatCard } from "./stat-card";
import { EndpointCard } from "./endpoint-card";
import { ErrorState } from "./error-state";
import { formatLatency, formatNumber } from "@/lib/formatters";
import { Globe, Heart, Timer } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

export function EndpointsList() {
  const { data, error, isLoading, mutate } = useEndpoints();

  if (error && !data) {
    return (
      <ErrorState
        message="Failed to load endpoints"
        onRetry={() => mutate()}
      />
    );
  }

  const endpoints = data?.endpoints ?? [];
  const healthyCount = endpoints.filter(
    (e) => e.latestCheck?.isHealthy
  ).length;
  const avgLatency =
    endpoints.length > 0
      ? endpoints.reduce(
          (sum, e) => sum + (e.stats24h.avgLatency ?? 0),
          0
        ) / endpoints.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Endpoints"
          value={formatNumber(endpoints.length)}
          icon={<Globe className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title={
            <span className="flex items-center gap-1">
              Healthy
              <HelpTooltip content={helpContent.endpoints.fields.healthy} side="bottom" />
            </span>
          }
          value={`${healthyCount} / ${endpoints.length}`}
          subtitle={
            healthyCount === endpoints.length
              ? "all operational"
              : `${endpoints.length - healthyCount} degraded`
          }
          icon={<Heart className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title={
            <span className="flex items-center gap-1">
              Avg Latency
              <HelpTooltip content={helpContent.endpoints.fields.latency} side="bottom" />
            </span>
          }
          value={avgLatency > 0 ? formatLatency(avgLatency) : "--"}
          subtitle="across all endpoints"
          icon={<Timer className="size-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Endpoint cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl border border-slate-DEFAULT/20 bg-midnight-plum"
              />
            ))
          : endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
      </div>
    </div>
  );
}
