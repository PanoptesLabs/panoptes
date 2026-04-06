"use client";

import { useValidatorSigning } from "@/hooks/use-validator-yaci";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { formatNumber } from "@/lib/formatters";

interface ValidatorSigningStatsProps {
  validatorId: string;
}

function getSigningColor(pct: number): string {
  if (pct >= 99) return "text-teal-DEFAULT";
  if (pct >= 95) return "text-amber-DEFAULT";
  return "text-rose-DEFAULT";
}

function getSigningBg(pct: number): string {
  if (pct >= 99) return "bg-teal-DEFAULT/10 border-teal-DEFAULT/20";
  if (pct >= 95) return "bg-amber-DEFAULT/10 border-amber-DEFAULT/20";
  return "bg-rose-DEFAULT/10 border-rose-DEFAULT/20";
}

export function ValidatorSigningStats({ validatorId }: ValidatorSigningStatsProps) {
  const { data: stats, error } = useValidatorSigning(validatorId);

  // Upstream error → show degraded state so it doesn't look like missing data
  if (error) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
            <Activity className="size-4" />
            Signing Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-dusty-lavender/50">Signing data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const pct = stats.signing_percentage;

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
          <Activity className="size-4" />
          Signing Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`mb-3 rounded-lg border p-3 ${getSigningBg(pct)}`}>
          <p className={`text-center font-mono text-3xl font-bold ${getSigningColor(pct)}`}>
            {pct.toFixed(2)}%
          </p>
          <p className="mt-1 text-center text-xs text-dusty-lavender/50">
            signing rate
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-mono text-sm font-medium text-mist">
              {formatNumber(stats.blocks_signed)}
            </p>
            <p className="text-[10px] text-dusty-lavender/50">signed</p>
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-rose-DEFAULT">
              {formatNumber(stats.blocks_missed)}
            </p>
            <p className="text-[10px] text-dusty-lavender/50">missed</p>
          </div>
          <div>
            <p className="font-mono text-sm font-medium text-dusty-lavender">
              {formatNumber(stats.total_blocks)}
            </p>
            <p className="text-[10px] text-dusty-lavender/50">total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
