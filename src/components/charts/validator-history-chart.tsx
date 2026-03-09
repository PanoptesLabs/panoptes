"use client";

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
import type { ValidatorSnapshotItem } from "@/types";

interface ValidatorHistoryChartProps {
  snapshots: ValidatorSnapshotItem[];
  dataKey: "tokens" | "commission" | "votingPower";
  label: string;
  color?: string;
  formatter?: (value: number) => string;
}

export function ValidatorHistoryChart({
  snapshots,
  dataKey,
  label,
  color = "#8B5CF6",
  formatter,
}: ValidatorHistoryChartProps) {
  const chartData = snapshots
    .slice()
    .reverse()
    .map((snap) => ({
      date: snap.timestamp,
      value:
        dataKey === "commission"
          ? snap.commission
          : Number(BigInt(snap[dataKey]) / BigInt(10 ** 12)) / 1_000_000,
    }));

  const formatValue = formatter ?? ((v: number) => v.toLocaleString());

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={`vhGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
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
          tickFormatter={(v) => formatValue(v)}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatChartDate}
              formatter={(value) => `${formatValue(value)} ${label}`}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#vhGrad-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
