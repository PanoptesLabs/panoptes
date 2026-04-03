import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const url = new URL(request.url);
  const days = Math.min(Math.max(1, Number(url.searchParams.get("days")) || 7), 30);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get delegation snapshots for flow analysis
  const snapshots = await prisma.delegationSnapshot.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: "desc" },
    select: {
      validatorId: true,
      totalDelegators: true,
      totalDelegated: true,
      churnRate: true,
      timestamp: true,
    },
  });

  // Group by validator
  const validatorFlow = new Map<string, {
    validatorId: string;
    latestDelegators: number;
    latestDelegated: string;
    avgChurnRate: number;
    snapshotCount: number;
  }>();

  for (const snap of snapshots) {
    const existing = validatorFlow.get(snap.validatorId);
    if (!existing) {
      validatorFlow.set(snap.validatorId, {
        validatorId: snap.validatorId,
        latestDelegators: snap.totalDelegators,
        latestDelegated: snap.totalDelegated,
        avgChurnRate: snap.churnRate,
        snapshotCount: 1,
      });
    } else {
      existing.avgChurnRate = (existing.avgChurnRate * existing.snapshotCount + snap.churnRate) / (existing.snapshotCount + 1);
      existing.snapshotCount++;
    }
  }

  // Fetch monikers for all validators in flow
  const validatorIds = [...validatorFlow.keys()];
  const validators = validatorIds.length > 0
    ? await prisma.validator.findMany({
        where: { id: { in: validatorIds } },
        select: { id: true, moniker: true },
      })
    : [];

  const monikerMap = new Map(validators.map((v) => [v.id, v.moniker]));

  const flow = [...validatorFlow.values()]
    .sort((a, b) => b.avgChurnRate - a.avgChurnRate)
    .map((v) => ({
      ...v,
      moniker: monikerMap.get(v.validatorId) || null,
    }));

  return jsonResponse({ flow, days }, rl.headers);
}
