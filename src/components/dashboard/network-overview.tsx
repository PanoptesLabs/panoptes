"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useNetworkStats } from "@/hooks/use-stats";
import { useHistorySparklines } from "@/hooks/use-history-sparklines";
import { StatCard } from "./stat-card";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ChartSkeleton = () => <Skeleton className="h-64 w-full rounded-lg bg-deep-iris/20" />;

const StakingTrendChart = dynamic(
  () => import("@/components/charts/staking-trend-chart").then((m) => m.StakingTrendChart),
  { ssr: false, loading: ChartSkeleton },
);
const BlockHeightChart = dynamic(
  () => import("@/components/charts/block-height-chart").then((m) => m.BlockHeightChart),
  { ssr: false, loading: ChartSkeleton },
);
const ValidatorCountChart = dynamic(
  () => import("@/components/charts/validator-count-chart").then((m) => m.ValidatorCountChart),
  { ssr: false, loading: ChartSkeleton },
);
const BondedRatioChart = dynamic(
  () => import("@/components/charts/bonded-ratio-chart").then((m) => m.BondedRatioChart),
  { ssr: false, loading: ChartSkeleton },
);

import {
  formatTokensShort,
  formatBlockHeight,
  formatNumber,
} from "@/lib/formatters";
import {
  Shield,
  ShieldCheck,
  Coins,
  Blocks,
  Users,
  TrendingUp,
  Percent,
} from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

export function NetworkOverview() {
  const { data, error, isLoading, mutate } = useNetworkStats();

  const current = data?.current;
  const history = useMemo(() => data?.history ?? [], [data?.history]);

  const { stakingSparkline, blockSparkline } = useHistorySparklines(history);

  if (error && !data) {
    return (
      <ErrorState
        message="Failed to load network stats"
        onRetry={() => mutate()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Validators"
          value={current ? formatNumber(current.totalValidators) : "--"}
          icon={<Users className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Validators"
          value={current ? formatNumber(current.activeValidators) : "--"}
          icon={<ShieldCheck className="size-4" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Staked"
          value={current ? formatTokensShort(current.totalStaked) : "--"}
          icon={<Coins className="size-4" />}
          sparklineData={stakingSparkline}
          isLoading={isLoading}
        />
        <StatCard
          title={
            <span className="flex items-center gap-1">
              Block Height
              <HelpTooltip content={helpContent.network.fields.blockHeight} side="bottom" />
            </span>
          }
          value={current ? formatBlockHeight(current.blockHeight) : "--"}
          subtitle={
            current?.avgBlockTime
              ? `~${current.avgBlockTime.toFixed(1)}s block time`
              : undefined
          }
          icon={<Blocks className="size-4" />}
          sparklineData={blockSparkline}
          isLoading={isLoading}
        />
      </div>

      {/* Charts row 1 */}
      {history.length > 1 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                  <Shield className="size-4" />
                  Validator Count Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ValidatorCountChart data={history} />
              </CardContent>
            </Card>
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                  <TrendingUp className="size-4" />
                  Staking Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StakingTrendChart data={history} />
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                  <Blocks className="size-4" />
                  Block Height Progression
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BlockHeightChart data={history} />
              </CardContent>
            </Card>
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                  <Percent className="size-4" />
                  Bonded Ratio
                  <HelpTooltip content={helpContent.network.fields.bondedRatio} side="right" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BondedRatioChart data={history} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
