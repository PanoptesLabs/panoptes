"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import type { YaciValidatorReward } from "@/types";

interface RewardHistoryChartProps {
  data: YaciValidatorReward[];
}

const ARAI_DIVISOR = 1e18;

export function RewardHistoryChart({ data }: RewardHistoryChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      height: item.height,
      rewards: Number(item.rewards) / ARAI_DIVISOR,
      commission: Number(item.commission) / ARAI_DIVISOR,
    }));

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid stroke="rgba(71, 85, 105, 0.1)" strokeDasharray="3 3" />
        <XAxis
          dataKey="height"
          tickFormatter={(v) => `#${Number(v).toLocaleString()}`}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => {
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
            return v.toFixed(1);
          }}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(label) => `Block #${Number(label).toLocaleString()}`}
              formatter={(value) => `${Number(value).toFixed(4)} RAI`}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "rgba(196, 181, 253, 0.5)" }}
        />
        <Bar dataKey="rewards" fill="#8B5CF6" name="Rewards" radius={[2, 2, 0, 0]} />
        <Bar dataKey="commission" fill="#D97706" name="Commission" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
