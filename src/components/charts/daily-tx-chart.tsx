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
import type { YaciDailyTxStats } from "@/types";

interface DailyTxChartProps {
  data: YaciDailyTxStats[];
}

export function DailyTxChart({ data }: DailyTxChartProps) {
  const gradientId = useId();
  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      date: item.date,
      txs: item.total_txs,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
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
            return String(Math.round(v));
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
              formatter={(value) => value.toLocaleString()}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="txs"
          stroke="#14b8a6"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          name="Transactions"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
