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
import { formatChartDate } from "@/lib/time";
import { formatBlockHeight } from "@/lib/formatters";
import type { NetworkStatsItem } from "@/types";

interface BlockHeightChartProps {
  data: NetworkStatsItem[];
}

export function BlockHeightChart({ data }: BlockHeightChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      date: item.timestamp,
      height: Number(item.blockHeight),
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
          tickFormatter={(v) => formatBlockHeight(String(v))}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatChartDate}
              formatter={(value) => formatBlockHeight(String(value))}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="height"
          stroke="#0D9488"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#0D9488", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
