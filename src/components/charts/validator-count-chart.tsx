"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { formatChartDate } from "@/lib/time";
import type { NetworkStatsItem } from "@/types";

interface ValidatorCountChartProps {
  data: NetworkStatsItem[];
}

export function ValidatorCountChart({ data }: ValidatorCountChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((item) => ({
      date: item.timestamp,
      total: item.totalValidators,
      active: item.activeValidators,
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
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={formatChartDate}
              formatter={(value, name) =>
                `${value} ${name === "total" ? "total" : "active"}`
              }
            />
          }
        />
        <Legend
          verticalAlign="top"
          height={30}
          formatter={(value) => (
            <span className="text-xs text-dusty-lavender/70">
              {value === "total" ? "Total" : "Active"}
            </span>
          )}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#C4B5FD"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="active"
          stroke="#0D9488"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
