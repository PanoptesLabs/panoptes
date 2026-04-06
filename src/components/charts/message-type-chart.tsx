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
import type { YaciMessageTypeStat } from "@/types";

interface MessageTypeChartProps {
  data: YaciMessageTypeStat[];
}

function shortenMessageType(msgType: string): string {
  // "/cosmos.staking.v1beta1.MsgDelegate" → "MsgDelegate"
  const parts = msgType.split(".");
  return parts[parts.length - 1] ?? msgType;
}

export function MessageTypeChart({ data }: MessageTypeChartProps) {
  const chartData = data.map((item) => ({
    name: shortenMessageType(item.message_type),
    count: item.count,
    fullName: item.message_type,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
        <CartesianGrid stroke="rgba(71, 85, 105, 0.1)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => {
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
            return String(v);
          }}
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "rgba(196, 181, 253, 0.5)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(label) => label}
              formatter={(value) => value.toLocaleString()}
            />
          }
        />
        <Bar
          dataKey="count"
          fill="#8B5CF6"
          radius={[0, 4, 4, 0]}
          name="Count"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
