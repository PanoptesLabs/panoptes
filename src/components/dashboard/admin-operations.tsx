"use client";

import { useState } from "react";
import {
  useAdminOperations,
  disableWebhook,
  disablePolicy,
} from "@/hooks/use-admin";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SEVERITY_BADGE_COLORS, STATUS_BADGE_COLORS } from "@/lib/constants";
import { Settings, ScrollText, Siren, Ban } from "lucide-react";
import { ConfirmBanner } from "./confirm-banner";

interface PendingAction {
  type: "disable-webhook" | "disable-policy";
  id: string;
  label: string;
  name: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="pt-6">
            <Skeleton className="h-32 w-full bg-deep-iris/20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminOperations() {
  const { data, error, isLoading, mutate } = useAdminOperations();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message="Failed to load operations data" onRetry={() => mutate()} />;
  if (!data) return null;

  const handleConfirm = async () => {
    if (!pending) return;
    const key = `${pending.type}-${pending.id}`;
    setPending(null);
    setLoadingAction(key);
    try {
      if (pending.type === "disable-webhook") {
        await disableWebhook(pending.id);
        toast.success(`Webhook "${pending.name}" disabled`);
      } else {
        await disablePolicy(pending.id);
        toast.success(`Policy "${pending.name}" disabled`);
      }
      mutate();
    } catch {
      toast.error(`Failed to disable ${pending.type === "disable-webhook" ? "webhook" : "policy"}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirm banner */}
      {pending && (
        <ConfirmBanner
          message={pending.label}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Webhooks */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
            <Settings className="size-4 text-teal-DEFAULT" />
            Webhooks ({data.webhooks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.webhooks.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No webhooks configured</p>
          ) : (
            <div className="space-y-2">
              {data.webhooks.map((webhook) => (
                <div key={webhook.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-deep-iris/10 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-mist">{webhook.name}</p>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        webhook.isActive ? "bg-teal-DEFAULT/15 text-teal-DEFAULT" : "bg-rose-DEFAULT/15 text-rose-DEFAULT",
                      )}>
                        {webhook.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-dusty-lavender/50">
                      {webhook.totalDeliveries} deliveries &middot; {Math.round(webhook.successRate * 100)}% success
                      {webhook.lastDeliveryAt && (
                        <> &middot; last {timeAgo(webhook.lastDeliveryAt)}</>
                      )}
                    </p>
                  </div>
                  {webhook.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending({
                        type: "disable-webhook",
                        id: webhook.id,
                        name: webhook.name,
                        label: `Disable webhook "${webhook.name}"? It will stop receiving events.`,
                      })}
                      disabled={loadingAction === `disable-webhook-${webhook.id}`}
                      className="h-6 px-2 text-[10px] text-rose-DEFAULT/70 hover:text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
                    >
                      <Ban className="size-3 mr-0.5" />
                      Disable
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
            <ScrollText className="size-4 text-amber-DEFAULT" />
            Policies ({data.policies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.policies.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No policies configured</p>
          ) : (
            <div className="space-y-2">
              {data.policies.map((policy) => (
                <div key={policy.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-deep-iris/10 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-mist">{policy.name}</p>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        policy.isActive ? "bg-teal-DEFAULT/15 text-teal-DEFAULT" : "bg-rose-DEFAULT/15 text-rose-DEFAULT",
                      )}>
                        {policy.isActive ? "Active" : "Disabled"}
                      </span>
                      {policy.dryRun && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-DEFAULT/15 text-amber-DEFAULT">
                          Dry Run
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-dusty-lavender/50">
                      {policy.executionCount} executions
                      {policy.lastTriggeredAt && (
                        <> &middot; last triggered {timeAgo(policy.lastTriggeredAt)}</>
                      )}
                    </p>
                  </div>
                  {policy.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending({
                        type: "disable-policy",
                        id: policy.id,
                        name: policy.name,
                        label: `Disable policy "${policy.name}"? It will stop evaluating conditions.`,
                      })}
                      disabled={loadingAction === `disable-policy-${policy.id}`}
                      className="h-6 px-2 text-[10px] text-rose-DEFAULT/70 hover:text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
                    >
                      <Ban className="size-3 mr-0.5" />
                      Disable
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
            <Siren className="size-4 text-rose-DEFAULT" />
            Recent Incidents ({data.recentIncidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentIncidents.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No incidents</p>
          ) : (
            <div className="space-y-2">
              {data.recentIncidents.map((incident) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-deep-iris/10 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-mist">{incident.title}</p>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        SEVERITY_BADGE_COLORS[incident.severity] ?? SEVERITY_BADGE_COLORS.low,
                      )}>
                        {incident.severity}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        STATUS_BADGE_COLORS[incident.status] ?? STATUS_BADGE_COLORS.open,
                      )}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-dusty-lavender/50">
                      Detected {timeAgo(incident.detectedAt)}
                      {incident.resolvedAt && (
                        <> &middot; resolved {timeAgo(incident.resolvedAt)}</>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
