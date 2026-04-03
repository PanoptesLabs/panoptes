import { prisma } from "@/lib/db";

// Threshold = max acceptable deviation ratio for value-based metrics
const ACCURACY_THRESHOLDS: Record<string, number> = {
  latency: 0.30,
  jail_risk: 0.50,
  downtime: 0.30,
  unbonding: 0.30,
  breach_risk: 0.30,
};

const DEFAULT_THRESHOLD = 0.30;

// Only jail_risk uses direction-based accuracy:
// generator writes missedBlockRate (0-1 scale), verifier returns 0/1 jailed status
const RISK_METRICS = new Set(["jail_risk"]);

function checkAccuracy(metric: string, predictedValue: number, actualValue: number): boolean {
  const threshold = ACCURACY_THRESHOLDS[metric] ?? DEFAULT_THRESHOLD;

  // For risk-based metrics, check if the predicted direction was correct
  if (RISK_METRICS.has(metric)) {
    const predictedHigh = predictedValue > 0.5;
    const actualHigh = actualValue > 0.5;
    return predictedHigh === actualHigh;
  }

  // For value-based metrics, check if within threshold % of actual
  if (actualValue === 0) return predictedValue === 0;
  const deviation = Math.abs(predictedValue - actualValue) / Math.abs(actualValue);
  return deviation <= threshold;
}

export async function verifyExpiredForecasts(): Promise<{ verified: number; accurate: number; duration: number }> {
  const start = Date.now();

  // Find expired, unverified forecasts
  const expired = await prisma.forecast.findMany({
    where: {
      validUntil: { lt: new Date() },
      verifiedAt: null,
    },
    take: 100,
  });

  let verified = 0;
  let accurate = 0;

  for (const forecast of expired) {
    const actualValue = await resolveActualValue(forecast.entityType, forecast.entityId, forecast.metric);

    if (actualValue === null) {
      // Can't verify — mark as verified with no accuracy data
      await prisma.forecast.update({
        where: { id: forecast.id },
        data: { verifiedAt: new Date() },
      });
      verified++;
      continue;
    }

    const wasAccurate = checkAccuracy(forecast.metric, forecast.predictedValue, actualValue);

    await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        actualValue,
        wasAccurate,
        verifiedAt: new Date(),
      },
    });

    verified++;
    if (wasAccurate) accurate++;
  }

  return { verified, accurate, duration: Date.now() - start };
}

async function resolveActualValue(entityType: string, entityId: string, metric: string): Promise<number | null> {
  // jail_risk — check if validator is currently jailed (binary 0/1, direction-based accuracy)
  if (metric === "jail_risk" && entityType === "validator") {
    const validator = await prisma.validator.findUnique({
      where: { id: entityId },
      select: { jailed: true },
    });
    return validator ? (validator.jailed ? 1.0 : 0.0) : null;
  }

  // unbonding — compute actual delegation change % (same scale as generator's changePct)
  if (metric === "unbonding" && entityType === "validator") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snapshots = await prisma.delegationSnapshot.findMany({
      where: { validatorId: entityId, timestamp: { gte: sevenDaysAgo } },
      orderBy: { timestamp: "asc" },
      select: { totalDelegated: true },
    });
    if (snapshots.length < 2) return null;
    const first = Number(BigInt(snapshots[0].totalDelegated));
    const last = Number(BigInt(snapshots[snapshots.length - 1].totalDelegated));
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }

  // latency — get latest endpoint latency in ms (same scale as generator)
  if (metric === "latency" && entityType === "endpoint") {
    const recentCheck = await prisma.endpointHealth.findFirst({
      where: { endpointId: entityId },
      orderBy: { timestamp: "desc" },
      select: { latencyMs: true },
    });
    return recentCheck ? recentCheck.latencyMs : null;
  }

  // downtime — compute actual failure rate % (same scale as generator's failureRate * 100)
  if (metric === "downtime" && entityType === "endpoint") {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChecks = await prisma.endpointHealth.findMany({
      where: { endpointId: entityId, timestamp: { gte: oneDayAgo } },
      select: { isHealthy: true },
    });
    if (recentChecks.length === 0) return null;
    const failedCount = recentChecks.filter((c) => !c.isHealthy).length;
    return (failedCount / recentChecks.length) * 100;
  }

  // breach_risk — get current budget consumption % (same scale as generator's projected budget)
  if (metric === "breach_risk") {
    const slo = await prisma.slo.findFirst({
      where: { entityId, entityType },
      orderBy: { updatedAt: "desc" },
      include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } },
    });
    if (!slo || slo.evaluations.length === 0) return null;
    return slo.evaluations[0].budgetConsumed;
  }

  return null;
}
