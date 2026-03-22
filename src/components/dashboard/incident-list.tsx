"use client";

import { useState } from "react";
import Link from "next/link";
import { useIncidents, useIncidentSummary } from "@/hooks/use-incidents";
import { StatCard } from "./stat-card";
import { FilterSelect } from "./filter-select";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/lib/constants";
import { SEVERITY_ICON_COLORS } from "@/lib/color-utils";
import { Siren, AlertTriangle, CheckCircle, Eye, ShieldAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Pagination } from "./pagination";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Open", value: "open" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "Resolved", value: "resolved" },
];

const SEVERITY_OPTIONS = [
  { label: "All Severities", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const ENTITY_OPTIONS = [
  { label: "All Entities", value: "" },
  { label: "Validator", value: "validator" },
  { label: "Endpoint", value: "endpoint" },
  { label: "Network", value: "network" },
];


export function IncidentList() {
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [entityType, setEntityType] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data: summary, isLoading: summaryLoading } = useIncidentSummary();
  const { data, error, isLoading, mutate } = useIncidents({
    status: status || undefined,
    severity: severity || undefined,
    entityType: entityType || undefined,
    limit,
    offset,
  });

  if (error && !data) {
    return <ErrorState message="Failed to load incidents" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open"
          value={summary ? String(summary.open) : "--"}
          icon={<Siren className="size-4" />}
          isLoading={summaryLoading}
        />
        <StatCard
          title="Acknowledged"
          value={summary ? String(summary.acknowledged) : "--"}
          icon={<Eye className="size-4" />}
          isLoading={summaryLoading}
        />
        <StatCard
          title="Resolved"
          value={summary ? String(summary.resolved) : "--"}
          icon={<CheckCircle className="size-4" />}
          isLoading={summaryLoading}
        />
        <StatCard
          title="Critical"
          value={summary ? String(summary.critical) : "--"}
          icon={<ShieldAlert className="size-4" />}
          isLoading={summaryLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1">
          <FilterSelect label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setOffset(0); }} />
          {status && helpContent.incidents.statuses[status as keyof typeof helpContent.incidents.statuses] && (
            <HelpTooltip
              content={helpContent.incidents.statuses[status as keyof typeof helpContent.incidents.statuses]}
              side="right"
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <FilterSelect label="Severity" options={SEVERITY_OPTIONS} value={severity} onChange={(v) => { setSeverity(v); setOffset(0); }} />
          {severity && (
            <HelpTooltip content={helpContent.incidents.concepts.severity} side="right" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <FilterSelect label="Entity" options={ENTITY_OPTIONS} value={entityType} onChange={(v) => { setEntityType(v); setOffset(0); }} />
          {entityType && helpContent.anomalies.entityTypes[entityType as keyof typeof helpContent.anomalies.entityTypes] && (
            <HelpTooltip
              content={helpContent.anomalies.entityTypes[entityType as keyof typeof helpContent.anomalies.entityTypes]}
              side="right"
            />
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* Empty state */}
      {data && data.incidents.length === 0 && (
        <EmptyState
          icon={<Siren className="size-5 text-dusty-lavender/60" />}
          title="No incidents found"
          description="Incidents are created automatically from anomalies and SLO breaches."
        />
      )}

      {/* Incident list */}
      {data && data.incidents.length > 0 && (
        <div className="space-y-3">
          {data.incidents.map((incident) => (
            <Link key={incident.id} href={`/dashboard/incidents/${incident.id}`}>
              <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="mt-0.5">
                    <AlertTriangle
                      className={cn("size-5", SEVERITY_ICON_COLORS[incident.severity] ?? SEVERITY_ICON_COLORS.low)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-mist">{incident.title}</p>
                        <p className="mt-1 text-xs text-dusty-lavender/50">{incident.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low,
                          )}
                        >
                          {incident.severity}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            STATUS_COLORS[incident.status] ?? STATUS_COLORS.open,
                          )}
                        >
                          {incident.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-dusty-lavender/60">
                      <span>{incident.entityType}</span>
                      <span>Detected {timeAgo(incident.detectedAt)}</span>
                      {incident.resolvedAt && <span>Resolved {timeAgo(incident.resolvedAt)}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {data.total > limit && (
            <Pagination total={data.total} limit={limit} offset={offset} onPageChange={setOffset} />
          )}
        </div>
      )}
    </div>
  );
}
