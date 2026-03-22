"use client";

import { useState } from "react";
import { useDelegationEvents, useWhaleMovements } from "@/hooks/use-delegations";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { formatAmountShort } from "@/lib/formatters";
import { ArrowLeftRight, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Pagination } from "./pagination";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

const TYPE_CONFIG = {
  delegate: { label: "Delegate", color: "text-teal-DEFAULT", icon: ArrowUpRight },
  undelegate: { label: "Undelegate", color: "text-rose-DEFAULT", icon: ArrowDownRight },
  redelegate: { label: "Redelegate", color: "text-amber-DEFAULT", icon: ArrowLeftRight },
};

export function DelegationList() {
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const { data: eventsData, error: eventsError, isLoading: eventsLoading, mutate: mutateEvents } = useDelegationEvents({ limit, offset });
  const { data: whalesData, error: whalesError, isLoading: whalesLoading, mutate: mutateWhales } = useWhaleMovements();

  if (eventsError || whalesError) return <ErrorState message="Failed to load delegation data" onRetry={() => { mutateEvents(); mutateWhales(); }} />;

  if (eventsLoading || whalesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const events = eventsData?.events ?? [];
  const whales = whalesData?.whales ?? [];
  const unresolvedWhales = whales.filter((w) => !w.resolved);

  return (
    <div className="space-y-6">
      {/* Whale Alerts */}
      {unresolvedWhales.length > 0 && (
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
      )}

      {/* Recent Events */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">
            Recent Delegation Events ({eventsData?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <ArrowLeftRight className="mb-2 size-6 text-dusty-lavender/50" />
              <p className="text-xs text-dusty-lavender/60">No delegation events yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((e) => {
                const config = TYPE_CONFIG[e.type] || TYPE_CONFIG.delegate;
                const Icon = config.icon;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded bg-slate-dark/20 px-3 py-2">
                    <Icon className={`size-3.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1 font-medium ${config.color}`}>
                          {config.label}
                          {helpContent.delegations.types[e.type as keyof typeof helpContent.delegations.types] && (
                            <HelpTooltip
                              content={helpContent.delegations.types[e.type as keyof typeof helpContent.delegations.types]}
                              side="top"
                            />
                          )}
                        </span>
                        <span className="font-mono text-dusty-lavender/50 truncate max-w-[80px] sm:max-w-[120px]">
                          {e.delegator}
                        </span>
                        <span className="text-dusty-lavender/50">→</span>
                        <span className="font-mono text-dusty-lavender/50 truncate max-w-[80px] sm:max-w-[120px]">
                          {e.validatorTo}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-mist shrink-0">
                      {formatAmountShort(e.amount)}
                    </span>
                    <span className="text-[11px] text-dusty-lavender/60 shrink-0">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {(eventsData?.total ?? 0) > limit && (
            <div className="mt-3">
              <Pagination total={eventsData?.total ?? 0} limit={limit} offset={offset} onPageChange={setOffset} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
