"use client";

import { useWhaleMovements } from "@/hooks/use-delegations";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

export function WhaleMovements() {
  const { data, error, isLoading, mutate } = useWhaleMovements();

  if (error) return <ErrorState message="Failed to load whale movements" onRetry={() => mutate()} />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const whales = data?.whales ?? [];
  const unresolvedWhales = whales.filter((w) => !w.resolved);

  if (unresolvedWhales.length === 0) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="flex flex-col items-center py-12">
          <AlertTriangle className="mb-3 size-8 text-dusty-lavender/50" />
          <p className="text-sm text-dusty-lavender/50">No whale movements detected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-DEFAULT/30 bg-midnight-plum">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-DEFAULT">
          <AlertTriangle className="size-4" />
          Whale Movements ({unresolvedWhales.length})
          <HelpTooltip content={helpContent.delegations.types.whale} side="right" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unresolvedWhales.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded bg-amber-DEFAULT/5 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-mist">{w.title}</p>
              <p className="text-xs text-dusty-lavender/50">{timeAgo(w.detectedAt)}</p>
            </div>
            <span className={`text-xs font-medium ${
              w.severity === "critical" ? "text-rose-DEFAULT" : "text-amber-DEFAULT"
            }`}>
              {w.severity.toUpperCase()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
