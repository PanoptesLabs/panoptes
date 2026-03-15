"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/hooks/use-workspace";
import { useIncidents, useIncidentSummary } from "@/hooks/use-incidents";
import { StatCard } from "./stat-card";
import { FilterSelect } from "./filter-select";
import { ErrorState } from "./error-state";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { Siren, AlertTriangle, CheckCircle, Eye, ShieldAlert } from "lucide-react";

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

const severityColors: Record<string, string> = {
  critical: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  high: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  medium: "bg-orange-900/50 text-orange-300 border-orange-500/30",
  low: "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30",
};

const statusColors: Record<string, string> = {
  open: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  acknowledged: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  resolved: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30",
};

const severityIcons: Record<string, string> = {
  critical: "text-rose-DEFAULT",
  high: "text-amber-DEFAULT",
  medium: "text-orange-400",
  low: "text-dusty-lavender/50",
};

export function IncidentList() {
  const { token } = useWorkspace();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [entityType, setEntityType] = useState("");

  const { data: summary, isLoading: summaryLoading } = useIncidentSummary(token);
  const { data, error, isLoading, mutate } = useIncidents(token, {
    status: status || undefined,
    severity: severity || undefined,
    entityType: entityType || undefined,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FilterSelect label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <FilterSelect label="Severity" options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />
        <FilterSelect label="Entity" options={ENTITY_OPTIONS} value={entityType} onChange={setEntityType} />
      </div>

      {/* Loading */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
        </div>
      )}

      {/* Empty state */}
      {data && data.incidents.length === 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Siren className="size-8 text-dusty-lavender/30" />
            <p className="text-sm text-dusty-lavender/50">No incidents found</p>
          </CardContent>
        </Card>
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
                      className={cn("size-5", severityIcons[incident.severity] ?? severityIcons.low)}
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
                            severityColors[incident.severity] ?? severityColors.low,
                          )}
                        >
                          {incident.severity}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            statusColors[incident.status] ?? statusColors.open,
                          )}
                        >
                          {incident.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-dusty-lavender/40">
                      <span>{incident.entityType}</span>
                      <span>Detected {timeAgo(incident.detectedAt)}</span>
                      {incident.resolvedAt && <span>Resolved {timeAgo(incident.resolvedAt)}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {data.total > data.incidents.length && (
            <p className="text-center text-xs text-dusty-lavender/40">
              Showing {data.incidents.length} of {data.total} incidents
            </p>
          )}
        </div>
      )}
    </div>
  );
}
