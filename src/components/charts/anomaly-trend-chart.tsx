"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendEntry {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface AnomalyTrendChartProps {
  data: TrendEntry[];
}

const SEVERITY_COLORS = {
  critical: "#e07070",
  high: "#e5a366",
  medium: "#9d8ec7",
  low: "#56b3a0",
};

export function AnomalyTrendChart({ data }: AnomalyTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#a78bfa" }}
          tickFormatter={(v: string) => v.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#a78bfa" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1329",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend
          iconSize={10}
          wrapperStyle={{ fontSize: "11px", color: "#a78bfa" }}
        />
        <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} radius={[0, 0, 0, 0]} />
        <Bar dataKey="high" stackId="a" fill={SEVERITY_COLORS.high} radius={[0, 0, 0, 0]} />
        <Bar dataKey="medium" stackId="a" fill={SEVERITY_COLORS.medium} radius={[0, 0, 0, 0]} />
        <Bar dataKey="low" stackId="a" fill={SEVERITY_COLORS.low} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
