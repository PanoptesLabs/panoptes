import { prisma } from "@/lib/db";

// Threshold = max acceptable deviation ratio for value-based metrics
const ACCURACY_THRESHOLDS: Record<string, number> = {
  latency: 0.30,
  jail_risk: 0.50,
  downtime: 0.50,
  unbonding: 0.30,
  breach_risk: 0.50,
};

const DEFAULT_THRESHOLD = 0.30;

// Metrics that represent risk probabilities (0-1 range)
const RISK_METRICS = new Set(["jail_risk", "breach_risk"]);

function checkAccuracy(metric: string, predictedValue: number, actualValue: number): boolean {
  const threshold = ACCURACY_THRESHOLDS[metric] ?? DEFAULT_THRESHOLD;

  // For risk-based metrics (0-1 range), check if the predicted direction was correct
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
  // jail_risk — check if validator is currently jailed
  if (metric === "jail_risk" && entityType === "validator") {
    const validator = await prisma.validator.findUnique({
      where: { id: entityId },
      select: { jailed: true },
    });
    return validator ? (validator.jailed ? 1.0 : 0.0) : null;
  }

  // unbonding — check if validator is no longer bonded
  if (metric === "unbonding" && entityType === "validator") {
    const validator = await prisma.validator.findUnique({
      where: { id: entityId },
      select: { status: true },
    });
    return validator ? (validator.status !== "BOND_STATUS_BONDED" ? 1.0 : 0.0) : null;
  }

  // latency — get latest endpoint latency
  if (metric === "latency" && entityType === "endpoint") {
    const recentCheck = await prisma.endpointHealth.findFirst({
      where: { endpointId: entityId },
      orderBy: { timestamp: "desc" },
      select: { latencyMs: true },
    });
    return recentCheck ? recentCheck.latencyMs : null;
  }

  // downtime — check if endpoint is currently down
  if (metric === "downtime" && entityType === "endpoint") {
    const recentCheck = await prisma.endpointHealth.findFirst({
      where: { endpointId: entityId },
      orderBy: { timestamp: "desc" },
      select: { isHealthy: true },
    });
    return recentCheck ? (recentCheck.isHealthy ? 0.0 : 1.0) : null;
  }

  // breach_risk — check if SLO is currently breaching
  if (metric === "breach_risk") {
    const slo = await prisma.slo.findFirst({
      where: { entityId, entityType },
      orderBy: { updatedAt: "desc" },
      select: { isBreaching: true },
    });
    return slo ? (slo.isBreaching ? 1.0 : 0.0) : null;
  }

  return null;
}
