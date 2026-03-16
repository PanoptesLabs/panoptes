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

interface TrendPoint {
  timestamp: string;
  score: number;
}

interface TrendLineChartProps {
  data: TrendPoint[];
  height?: number;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TrendLineChart({ data, height = 300 }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-dusty-lavender/50">No trend data available</p>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: formatDate(point.timestamp),
    score: Math.round(point.score * 100) / 100,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3d3557" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#9d8ec7", fontSize: 11 }}
            stroke="#3d3557"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#9d8ec7", fontSize: 11 }}
            stroke="#3d3557"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1528",
              border: "1px solid #3d3557",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#d4cde6" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#9d8ec7"
            strokeWidth={2}
            dot={{ fill: "#9d8ec7", r: 3 }}
            activeDot={{ fill: "#b5a5d9", r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
