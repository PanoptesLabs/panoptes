"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import type { YaciBlockMetric } from "@/types";

interface BlockTimeChartProps {
  data: YaciBlockMetric[];
}

export function BlockTimeChart({ data }: BlockTimeChartProps) {
  // Compute deltas only between consecutive height pairs where both have non-null block_time.
  // This avoids inflated deltas when null entries exist mid-series.
  const sorted = data.slice().reverse();
  const chartData: { height: number; seconds: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.block_time === null || curr.block_time === null) continue;
    if (curr.height !== prev.height + 1) continue; // skip non-consecutive
    const seconds = Math.max(0, (new Date(curr.block_time).getTime() - new Date(prev.block_time).getTime()) / 1000);
    chartData.push({ height: curr.height, seconds });
  }

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
          tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(label) => `Block #${Number(label).toLocaleString()}`}
              formatter={(value) => `${Number(value).toFixed(2)}s`}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="seconds"
          stroke="#ec4899"
          strokeWidth={1.5}
          dot={false}
          name="Block Time"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
