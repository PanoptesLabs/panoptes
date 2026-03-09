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
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { formatChartDate } from "@/lib/time";
import type { NetworkStatsItem } from "@/types";

interface BondedRatioChartProps {
  data: NetworkStatsItem[];
}

export function BondedRatioChart({ data }: BondedRatioChartProps) {
  const gradientId = useId();
  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      date: item.timestamp,
      ratio: item.bondedRatio !== null ? item.bondedRatio * 100 : null,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
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
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={50}
          domain={[0, 100]}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatChartDate}
              formatter={(value) => `${value.toFixed(1)}%`}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="ratio"
          stroke="#0D9488"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
