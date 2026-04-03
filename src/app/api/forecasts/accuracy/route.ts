import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") ?? undefined;
  const daysParam = parseInt(searchParams.get("days") ?? "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const baseWhere = {
    verifiedAt: { not: null },
    createdAt: { gte: since },
    ...(metric ? { metric } : {}),
  };

  // Only count forecasts where accuracy could be determined (wasAccurate is not null)
  const verifiableWhere = { ...baseWhere, wasAccurate: { not: null } };

  const [totalVerified, totalVerifiable, totalAccurate, byMetricRaw] = await Promise.all([
    prisma.forecast.count({ where: baseWhere }),
    prisma.forecast.count({ where: verifiableWhere }),
    prisma.forecast.count({ where: { ...baseWhere, wasAccurate: true } }),
    prisma.forecast.groupBy({
      by: ["metric"],
      where: verifiableWhere,
      _count: { id: true },
    }),
  ]);

  // Get accurate count per metric
  const accurateByMetric = await prisma.forecast.groupBy({
    by: ["metric"],
    where: { ...baseWhere, wasAccurate: true },
    _count: { id: true },
  });

  const accurateMap = new Map(accurateByMetric.map((r) => [r.metric, r._count.id]));

  const byMetric = byMetricRaw.map((r) => ({
    metric: r.metric,
    total: r._count.id,
    accurate: accurateMap.get(r.metric) ?? 0,
    accuracyRate: r._count.id > 0
      ? Math.round(((accurateMap.get(r.metric) ?? 0) / r._count.id) * 10000) / 100
      : 0,
  }));

  const overallAccuracy = totalVerifiable > 0
    ? Math.round((totalAccurate / totalVerifiable) * 10000) / 100
    : null;

  return jsonResponse({
    days,
    totalVerified,
    totalVerifiable,
    unverifiable: totalVerified - totalVerifiable,
    totalAccurate,
    overallAccuracy,
    byMetric,
  }, rl.headers);
}
