"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { useIncidentDetail, acknowledgeIncident, resolveIncident, addIncidentComment } from "@/hooks/use-incidents";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo, formatDateTime } from "@/lib/time";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/lib/constants";
import {
  Eye,
  CheckCircle,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Circle,
  Link as LinkIcon,
  Send,
} from "lucide-react";
import type { IncidentEventType } from "@/types";
import { Spinner } from "@/components/ui/spinner";
import { AuthGate } from "./auth-gate";

const eventTypeConfig: Record<IncidentEventType, { icon: typeof Circle; color: string; label: string }> = {
  created: { icon: Circle, color: "text-teal-DEFAULT", label: "Created" },
  slo_linked: { icon: LinkIcon, color: "text-blue-400", label: "SLO Linked" },
  anomaly_linked: { icon: AlertTriangle, color: "text-orange-400", label: "Anomaly Linked" },
  acknowledged: { icon: Eye, color: "text-amber-DEFAULT", label: "Acknowledged" },
  resolved: { icon: CheckCircle, color: "text-teal-DEFAULT", label: "Resolved" },
  comment: { icon: MessageSquare, color: "text-dusty-lavender/70", label: "Comment" },
};

interface IncidentDetailProps {
  incidentId: string;
}

export function IncidentDetail({ incidentId }: IncidentDetailProps) {
  const { data: incident, error, isLoading, mutate } = useIncidentDetail(incidentId);
  const { mutate: globalMutate } = useSWRConfig();
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !incident) {
    return <ErrorState message="Failed to load incident" onRetry={() => mutate()} />;
  }

  const handleAction = async (action: "acknowledge" | "resolve") => {
    setActionLoading(action);
    setActionError(null);
    try {
      if (action === "acknowledge") {
        await acknowledgeIncident(incidentId);
      } else {
        await resolveIncident(incidentId);
      }
      await mutate();
      globalMutate("/api/incidents/summary");
      globalMutate((key: string) => typeof key === "string" && key.startsWith("/api/incidents"), undefined, { revalidate: true });
    } catch {
      setActionError(`Failed to ${action} incident. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setActionLoading("comment");
    setActionError(null);
    try {
      await addIncidentComment(incidentId, comment.trim());
      setComment("");
      await mutate();
    } catch {
      setActionError("Failed to add comment. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-medium text-mist">{incident.title}</h2>
              <p className="mt-1 text-sm text-dusty-lavender/50">{incident.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low,
                  )}
                >
                  {incident.severity}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    STATUS_COLORS[incident.status] ?? STATUS_COLORS.open,
                  )}
                >
                  {incident.status}
                </span>
                <span className="text-xs text-dusty-lavender/60">
                  {incident.entityType} &middot; {incident.entityId}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-dusty-lavender/60">
                <span>Detected {formatDateTime(incident.detectedAt)}</span>
                {incident.acknowledgedAt && <span>Acknowledged {timeAgo(incident.acknowledgedAt)}</span>}
                {incident.resolvedAt && <span>Resolved {timeAgo(incident.resolvedAt)}</span>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {incident.status === "open" && (
                <AuthGate requiredRole="member" onAction={() => handleAction("acknowledge")}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading !== null}
                    className="border-amber-DEFAULT/30 bg-amber-dark/20 text-amber-light hover:bg-amber-dark/40"
                  >
                    {actionLoading === "acknowledge" ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                    Acknowledge
                  </Button>
                </AuthGate>
              )}
              {incident.status !== "resolved" && (
                <AuthGate requiredRole="member" onAction={() => handleAction("resolve")}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading !== null}
                    className="border-teal-DEFAULT/30 bg-teal-dark/20 text-teal-light hover:bg-teal-dark/40"
                  >
                    {actionLoading === "resolve" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                    Resolve
                  </Button>
                </AuthGate>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-dusty-lavender/70">
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incident.events && incident.events.length > 0 ? (
            <div className="relative space-y-0">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-DEFAULT/20" />
              {incident.events.map((event) => {
                const config = eventTypeConfig[event.eventType] ?? eventTypeConfig.comment;
                const EventIcon = config.icon;
                return (
                  <div key={event.id} className="relative flex gap-4 py-3">
                    <div className={cn("relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-dark", config.color)}>
                      <EventIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-mist">{config.label}</span>
                        <span className="text-[11px] text-dusty-lavender/60">{timeAgo(event.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-dusty-lavender/60">{event.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-dusty-lavender/60">No events yet</p>
          )}
        </CardContent>
      </Card>

      {/* Error feedback */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-DEFAULT/30 bg-rose-dark/10 px-4 py-2.5 text-xs text-rose-light">
          <AlertTriangle className="size-3.5 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Comment form */}
      {incident.status !== "resolved" && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment();
                  }
                }}
                placeholder="Add a comment..."
                maxLength={1000}
                className="flex-1 resize-none rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 py-2 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50 focus:ring-1 focus:ring-soft-violet/20"
              />
              <AuthGate requiredRole="member" onAction={handleComment}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading === "comment" || !comment.trim()}
                  className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
                >
                  {actionLoading === "comment" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </Button>
              </AuthGate>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
