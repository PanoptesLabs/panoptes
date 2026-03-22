"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useValidatorDetail } from "@/hooks/use-validators";
import { StatusBadge } from "./status-badge";
import { CopyButton } from "./copy-button";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const ValidatorHistoryChart = dynamic(
  () => import("@/components/charts/validator-history-chart").then((m) => m.ValidatorHistoryChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-lg bg-deep-iris/20" /> },
);
import { getValidatorStatusInfo } from "@/lib/status";
import {
  formatTokens,
  formatTokensShort,
  formatCommission,
  truncateAddress,
  formatNumber,
} from "@/lib/formatters";
import { formatDate, timeAgo } from "@/lib/time";
import { CHART_COLORS } from "@/lib/constants";
import { ArrowLeft, ShieldAlert, Calendar } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { subDays } from "date-fns";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

interface ValidatorDetailProps {
  validatorId: string;
}

export function ValidatorDetail({ validatorId }: ValidatorDetailProps) {
  const [range, setRange] = useState<7 | 30 | 90>(7);

  const from = useMemo(
    () => subDays(new Date(), range).toISOString(),
    [range]
  );

  const { data, error, isLoading, mutate } = useValidatorDetail(validatorId, {
    from,
    limit: 500,
  });

  if (error && !data) {
    return (
      <ErrorState
        message="Failed to load validator details"
        onRetry={() => mutate()}
      />
    );
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-deep-iris/30" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-deep-iris/20" />
          ))}
        </div>
      </div>
    );
  }

  const v = data?.validator;
  const snapshots = data?.snapshots ?? [];

  if (!v) return null;

  const statusInfo = getValidatorStatusInfo(v.status);
  const statusKey = statusInfo.label.toLowerCase() as
    | "bonded"
    | "unbonding"
    | "unbonded";

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/dashboard/validators"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-dusty-lavender/50 transition-colors hover:text-dusty-lavender"
        >
          <ArrowLeft className="size-4" />
          Back to Validators
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-deep-iris/30 font-display text-lg font-bold text-soft-violet">
            {v.moniker.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-display text-2xl font-bold text-mist sm:text-3xl">
            {v.moniker}
          </h1>
          <StatusBadge status={statusKey} />
          {v.jailed && <StatusBadge status="jailed" />}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-dusty-lavender/50">
              Operator Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm text-mist">
                {truncateAddress(v.id)}
              </span>
              <CopyButton text={v.id} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1 text-xs text-dusty-lavender/50">
              Commission
              <HelpTooltip content={helpContent.validators.fields.commission} side="right" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-bold text-mist">
              {formatCommission(v.commission)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1 text-xs text-dusty-lavender/50">
              Jailed / Missed
              <HelpTooltip content={helpContent.validators.fields.missedBlocks} side="right" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {v.jailed && <ShieldAlert className="size-4 text-rose-DEFAULT" />}
              <span className="font-mono text-xl font-bold text-mist">
                {v.jailCount}
              </span>
              <span className="text-xs text-dusty-lavender/50">
                / {formatNumber(v.missedBlocks)} missed
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-dusty-lavender/50">
              First Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-dusty-lavender/60" />
              <span className="text-sm text-mist">{formatDate(v.firstSeen)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-dusty-lavender/50">
              Total Staked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-bold text-mist">
              {formatTokensShort(v.tokens)}
            </p>
            <p className="mt-1 text-xs text-dusty-lavender/60">
              {formatTokens(v.tokens)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-1 text-xs text-dusty-lavender/50">
              Voting Power
              <HelpTooltip content={helpContent.validators.fields.votingPower} side="right" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-bold text-mist">
              {formatTokensShort(v.votingPower)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-dusty-lavender/50">
              Last Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-mist">{timeAgo(v.lastUpdated)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Snapshot charts */}
      {snapshots.length > 1 && (
        <>
          {/* Range selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dusty-lavender/50">Period:</span>
            {RANGES.map((r) => (
              <Button
                key={r.label}
                variant={range === r.days ? "default" : "outline"}
                size="xs"
                onClick={() => setRange(r.days)}
                className={
                  range === r.days
                    ? "bg-soft-violet text-white"
                    : "border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
                }
              >
                {r.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-dusty-lavender/70">
                  Token History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ValidatorHistoryChart
                  snapshots={snapshots}
                  dataKey="tokens"
                  label="RAI"
                  color={CHART_COLORS.primary}
                  formatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                />
              </CardContent>
            </Card>
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-dusty-lavender/70">
                  Commission History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ValidatorHistoryChart
                  snapshots={snapshots}
                  dataKey="commission"
                  label=""
                  color={CHART_COLORS.secondary}
                  formatter={(v) => `${(v * 100).toFixed(1)}%`}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
