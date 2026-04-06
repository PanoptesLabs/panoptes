"use client";

import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { formatChartDate } from "@/lib/time";
import type { YaciDailyRewards } from "@/types";

interface DailyRewardsChartProps {
  data: YaciDailyRewards[];
}

const ARAI_DIVISOR = 1e18;

export function DailyRewardsChart({ data }: DailyRewardsChartProps) {
  const gradientRewards = useId();
  const gradientCommission = useId();

  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      date: item.date,
      rewards: Number(item.total_rewards) / ARAI_DIVISOR,
      commission: Number(item.total_commission) / ARAI_DIVISOR,
    }));

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={gradientRewards} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={gradientCommission} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D97706" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(71, 85, 105, 0.1)" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatChartDate}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => {
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
            return v.toFixed(0);
          }}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatChartDate}
              formatter={(value) => `${Number(value).toFixed(2)} RAI`}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "rgba(196, 181, 253, 0.5)" }}
        />
        <Area
          type="monotone"
          dataKey="rewards"
          stroke="#8B5CF6"
          strokeWidth={2}
          fill={`url(#${gradientRewards})`}
          name="Rewards"
        />
        <Area
          type="monotone"
          dataKey="commission"
          stroke="#D97706"
          strokeWidth={2}
          fill={`url(#${gradientCommission})`}
          name="Commission"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
