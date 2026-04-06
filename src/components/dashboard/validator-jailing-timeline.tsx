"use client";

import { useValidatorJailing } from "@/hooks/use-validator-yaci";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { formatNumber } from "@/lib/formatters";

interface ValidatorJailingTimelineProps {
  validatorId: string;
}

export function ValidatorJailingTimeline({ validatorId }: ValidatorJailingTimelineProps) {
  const { data: events, error } = useValidatorJailing(validatorId);

  // Upstream error → show degraded state
  if (error) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
            <ShieldAlert className="size-4" />
            Jailing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-dusty-lavender/50">Jailing data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) return null;

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
          <ShieldAlert className="size-4" />
          Jailing History ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-rose-DEFAULT/10 bg-rose-dark/5 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-mist">
                  Block #{formatNumber(event.height)}
                </p>
                <p className="text-[10px] text-dusty-lavender/50">
                  {event.current_block_flag} &middot; {timeAgo(event.detected_at)}
                </p>
              </div>
              <ShieldAlert className="size-3.5 shrink-0 text-rose-DEFAULT/60" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
