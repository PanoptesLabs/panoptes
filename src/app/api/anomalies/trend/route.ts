import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

interface TrendRow {
  day: Date;
  severity: string;
  count: bigint;
}

interface TrendEntry {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

function fillGaps(dayMap: Map<string, TrendEntry>, days: number): TrendEntry[] {
  const result: TrendEntry[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    result.push(
      dayMap.get(dateStr) ?? { date: dateStr, critical: 0, high: 0, medium: 0, low: 0 },
    );
  }

  return result;
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { searchParams } = new URL(request.url);
  const daysParam = parseInt(searchParams.get("days") ?? "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows: TrendRow[] = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', "detectedAt") AS day,
      severity,
      COUNT(*)::BIGINT AS count
    FROM "Anomaly"
    WHERE "detectedAt" >= ${since}
    GROUP BY DATE_TRUNC('day', "detectedAt"), severity
    ORDER BY day ASC, severity ASC
  `;

  // Pivot into { date, critical, high, medium, low } per day
  const dayMap = new Map<string, TrendEntry>();

  for (const row of rows) {
    const dateStr = row.day.toISOString().split("T")[0];
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { date: dateStr, critical: 0, high: 0, medium: 0, low: 0 });
    }
    const entry = dayMap.get(dateStr)!;
    const sev = row.severity as keyof Omit<TrendEntry, "date">;
    if (sev in entry) {
      entry[sev] = Number(row.count);
    }
  }

  // Fill empty days with zeros for continuous chart
  const trend = fillGaps(dayMap, days);

  return jsonResponse({ trend, days }, rl.headers);
}
