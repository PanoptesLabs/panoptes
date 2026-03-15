"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ValidatorData {
  name: string;
  color: string;
  metrics: {
    uptime: number;
    commission: number;
    governance: number;
    stakeStability: number;
    score: number;
  };
}

interface ValidatorRadarChartProps {
  data: ValidatorData[];
}

const METRIC_LABELS: Record<string, string> = {
  uptime: "Uptime",
  commission: "Commission",
  governance: "Governance",
  stakeStability: "Stability",
  score: "Score",
};

export function ValidatorRadarChart({ data }: ValidatorRadarChartProps) {
  if (data.length === 0) return null;

  const metricKeys = ["uptime", "commission", "governance", "stakeStability", "score"];

  const chartData = metricKeys.map((key) => {
    const point: Record<string, string | number> = {
      metric: METRIC_LABELS[key] ?? key,
    };
    data.forEach((validator) => {
      const raw = validator.metrics[key as keyof ValidatorData["metrics"]];
      // Normalize to 0-100 scale: commission is inverted (lower = better), score already 0-100
      if (key === "commission") {
        point[validator.name] = Math.round((1 - raw) * 100);
      } else if (key === "score") {
        point[validator.name] = Math.round(raw);
      } else {
        point[validator.name] = Math.round(raw * 100);
      }
    });
    return point;
  });

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#3d3557" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#9d8ec7", fontSize: 12 }}
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
          {data.map((validator) => (
            <Radar
              key={validator.name}
              name={validator.name}
              dataKey={validator.name}
              stroke={validator.color}
              fill={validator.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
