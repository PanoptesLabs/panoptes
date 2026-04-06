"use client";

import dynamic from "next/dynamic";
import {
  useDailyTxStats,
  useTxSuccessRate,
  useMessageTypeStats,
  useGasDistribution,
  useFeeRevenue,
  useBlockMetrics,
  useDailyRewards,
} from "@/hooks/use-network-analytics";
import { StatCard } from "./stat-card";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmountShort } from "@/lib/formatters";
import { Activity, CheckCircle, Coins, Fuel, BarChart3, Clock, TrendingUp } from "lucide-react";

const ChartSkeleton = () => <Skeleton className="h-64 w-full rounded-lg bg-deep-iris/20" />;

const DailyTxChart = dynamic(
  () => import("@/components/charts/daily-tx-chart").then((m) => m.DailyTxChart),
  { ssr: false, loading: ChartSkeleton },
);
const MessageTypeChart = dynamic(
  () => import("@/components/charts/message-type-chart").then((m) => m.MessageTypeChart),
  { ssr: false, loading: ChartSkeleton },
);
const GasDistributionChart = dynamic(
  () => import("@/components/charts/gas-distribution-chart").then((m) => m.GasDistributionChart),
  { ssr: false, loading: ChartSkeleton },
);
const BlockTimeChart = dynamic(
  () => import("@/components/charts/block-time-chart").then((m) => m.BlockTimeChart),
  { ssr: false, loading: ChartSkeleton },
);
const DailyRewardsChart = dynamic(
  () => import("@/components/charts/daily-rewards-chart").then((m) => m.DailyRewardsChart),
  { ssr: false, loading: ChartSkeleton },
);

export function NetworkActivity() {
  const { data: txStats } = useDailyTxStats();
  const { data: successRate } = useTxSuccessRate();
  const { data: messageTypes } = useMessageTypeStats();
  const { data: gasDist } = useGasDistribution();
  const { data: feeRevenue } = useFeeRevenue();
  const { data: blockMetrics } = useBlockMetrics();
  const { data: dailyRewards } = useDailyRewards();

  // Silently hide if all Yaci data is unavailable
  const hasAnyData = txStats || successRate || messageTypes || gasDist || feeRevenue || blockMetrics || dailyRewards;
  if (!hasAnyData) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards row */}
      {(successRate || feeRevenue) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {successRate && (
            <StatCard
              title={
                <span className="flex items-center gap-1">
                  TX Success Rate
                  <HelpTooltip content={helpContent.network.fields.txSuccessRate} side="right" />
                </span>
              }
              value={`${successRate.success_rate_percent.toFixed(2)}%`}
              subtitle={`${successRate.failed.toLocaleString()} failed of ${successRate.total.toLocaleString()}`}
              icon={<CheckCircle className="size-4" />}
            />
          )}
          {successRate && (
            <StatCard
              title="Total Transactions"
              value={successRate.total.toLocaleString()}
              subtitle={`${successRate.successful.toLocaleString()} successful`}
              icon={<Activity className="size-4" />}
            />
          )}
          {feeRevenue && (
            <StatCard
              title={
                <span className="flex items-center gap-1">
                  Fee Revenue
                  <HelpTooltip content={helpContent.network.fields.feeRevenue} side="right" />
                </span>
              }
              value={formatAmountShort(feeRevenue.total_amount)}
              subtitle={feeRevenue.denom.toUpperCase()}
              icon={<Coins className="size-4" />}
            />
          )}
        </div>
      )}

      {/* Chart row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {txStats && txStats.length > 0 && (
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <BarChart3 className="size-4" />
                Daily TX Volume (30d)
                <HelpTooltip content={helpContent.network.fields.dailyTxVolume} side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DailyTxChart data={txStats} />
            </CardContent>
          </Card>
        )}
        {messageTypes && messageTypes.length > 0 && (
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <Activity className="size-4" />
                Message Types
                <HelpTooltip content={helpContent.network.fields.messageTypes} side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MessageTypeChart data={messageTypes} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {gasDist && gasDist.length > 0 && (
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <Fuel className="size-4" />
                Gas Usage Distribution
                <HelpTooltip content={helpContent.network.fields.gasDistribution} side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GasDistributionChart data={gasDist} />
            </CardContent>
          </Card>
        )}
        {blockMetrics && blockMetrics.length > 1 && (
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <Clock className="size-4" />
                Block Time Trend (Last 100)
                <HelpTooltip content={helpContent.network.fields.blockTime} side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BlockTimeChart data={blockMetrics} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart row 3: Daily Rewards */}
      {dailyRewards && dailyRewards.length > 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
              <TrendingUp className="size-4" />
              Daily Rewards & Commission (30d)
              <HelpTooltip content={helpContent.network.fields.dailyRewards} side="right" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DailyRewardsChart data={dailyRewards} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
