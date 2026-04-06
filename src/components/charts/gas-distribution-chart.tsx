"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import type { YaciGasDistribution } from "@/types";

interface GasDistributionChartProps {
  data: YaciGasDistribution[];
}

export function GasDistributionChart({ data }: GasDistributionChartProps) {
  const chartData = data.map((item) => ({
    range: item.gas_range,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid stroke="rgba(71, 85, 105, 0.1)" strokeDasharray="3 3" />
        <XAxis
          dataKey="range"
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => {
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
            return String(v);
          }}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(label) => `Gas: ${label}`}
              formatter={(value) => value.toLocaleString()}
            />
          }
        />
        <Bar
          dataKey="count"
          fill="#D97706"
          radius={[4, 4, 0, 0]}
          name="Transactions"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
