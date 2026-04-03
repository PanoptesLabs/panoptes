"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface VoteBarChartProps {
  yes: number;
  no: number;
  abstain: number;
  veto: number;
}

const VOTE_COLORS = {
  yes: "#56b3a0",     // teal
  no: "#e07070",      // rose
  abstain: "#9d8ec7", // lavender
  veto: "#e5a366",    // amber
};

export function VoteBarChart({ yes, no, abstain, veto }: VoteBarChartProps) {
  const total = yes + no + abstain + veto;
  if (total === 0) return null;

  const data = [
    { name: "Yes", count: yes, pct: ((yes / total) * 100).toFixed(1), color: VOTE_COLORS.yes },
    { name: "No", count: no, pct: ((no / total) * 100).toFixed(1), color: VOTE_COLORS.no },
    { name: "Abstain", count: abstain, pct: ((abstain / total) * 100).toFixed(1), color: VOTE_COLORS.abstain },
    { name: "Veto", count: veto, pct: ((veto / total) * 100).toFixed(1), color: VOTE_COLORS.veto },
  ];

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={60}
          tick={{ fontSize: 12, fill: "#a78bfa" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1329",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value, _name, entry) => [
            `${value} (${(entry.payload as { pct?: string })?.pct ?? "0"}%)`,
            "Votes",
          ]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
