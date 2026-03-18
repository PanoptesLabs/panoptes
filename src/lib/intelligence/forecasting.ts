import { prisma } from "@/lib/db";
import { FORECAST_DEFAULTS } from "@/lib/constants";

export interface ForecastResult {
  entityType: string;
  entityId: string;
  metric: string;
  prediction: "warning" | "critical" | "normal";
  confidence: number;
  timeHorizon: string;
  currentValue: number;
  predictedValue: number;
  threshold: number | null;
  reasoning: string;
  validUntil: Date;
}

export function linearRegression(
  points: { x: number; y: number }[],
): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssTotal = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssResidual = points.reduce(
    (s, p) => s + (p.y - (slope * p.x + intercept)) ** 2,
    0,
  );
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

export async function forecastEndpointLatency(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        where: { timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  for (const ep of endpoints) {
    const healthyChecks = ep.healthChecks.filter((c) => c.isHealthy);
    if (healthyChecks.length < 3) continue;

    const startTime = healthyChecks[0].timestamp.getTime();
    const points = healthyChecks.map((c) => ({
      x: (c.timestamp.getTime() - startTime) / 60000, // minutes from start
      y: c.latencyMs,
    }));

    const { slope, intercept, r2 } = linearRegression(points);
    const confidence = Math.min(r2 * 100, FORECAST_DEFAULTS.CONFIDENCE_MAX);
    const currentValue = points[points.length - 1].y;

    for (const horizon of FORECAST_DEFAULTS.TIME_HORIZONS) {
      const minutes = horizon === "1h" ? 60 : horizon === "6h" ? 360 : 1440;
      const lastX = points[points.length - 1].x;
      const predictedValue = slope * (lastX + minutes) + intercept;

      let prediction: "warning" | "critical" | "normal" = "normal";
      let threshold: number | null = null;
      if (predictedValue > 10000) {
        prediction = "critical";
        threshold = 10000;
      } else if (predictedValue > 5000) {
        prediction = "warning";
        threshold = 5000;
      }

      const validUntil = new Date(
        Date.now() + minutes * 60 * 1000,
      );

      results.push({
        entityType: "endpoint",
        entityId: ep.id,
        metric: "latency",
        prediction,
        confidence,
        timeHorizon: horizon,
        currentValue,
        predictedValue: Math.max(0, predictedValue),
        threshold,
        reasoning:
          prediction === "normal"
            ? `Latency trend stable (slope: ${slope.toFixed(2)}ms/min)`
            : `Latency projected to reach ${Math.round(predictedValue)}ms within ${horizon} (slope: ${slope.toFixed(2)}ms/min)`,
        validUntil,
      });
    }
  }

  return results;
}

export async function forecastJailRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const validators = await prisma.validator.findMany({
    where: { jailed: false },
    include: {
      scores: {
        where: { timestamp: { gte: sevenDaysAgo } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  for (const val of validators) {
    if (val.scores.length < 2) continue;

    const startTime = val.scores[0].timestamp.getTime();
    const points = val.scores.map((s) => ({
      x: (s.timestamp.getTime() - startTime) / 3600000, // hours from start
      y: s.missedBlockRate,
    }));

    const { slope, r2 } = linearRegression(points);
    const confidence = Math.min(r2 * 100, FORECAST_DEFAULTS.CONFIDENCE_MAX);
    const latestRate = val.scores[val.scores.length - 1].missedBlockRate;
    const predictedRate = latestRate + slope * 24;

    let prediction: "warning" | "critical" | "normal" = "normal";
    let threshold: number | null = null;
    if (predictedRate > 0.8) {
      prediction = "critical";
      threshold = 0.8;
    } else if (predictedRate > 0.5) {
      prediction = "warning";
      threshold = 0.5;
    }

    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    results.push({
      entityType: "validator",
      entityId: val.id,
      metric: "jail_risk",
      prediction,
      confidence,
      timeHorizon: "24h",
      currentValue: latestRate,
      predictedValue: predictedRate,
      threshold,
      reasoning:
        prediction === "normal"
          ? `Missed block rate trend stable for ${val.moniker}`
          : `Missed block rate projected to reach ${predictedRate.toFixed(2)} within 24h for ${val.moniker}`,
      validUntil,
    });
  }

  return results;
}

export async function forecastDowntimeRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        where: { timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "desc" },
      },
    },
  });

  for (const ep of endpoints) {
    if (ep.healthChecks.length === 0) continue;

    // Count consecutive failures from most recent
    let consecutiveFailures = 0;
    for (const check of ep.healthChecks) {
      if (!check.isHealthy) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    const totalChecks = ep.healthChecks.length;
    const failureRate = ep.healthChecks.filter((c) => !c.isHealthy).length / totalChecks;
    const confidence = Math.min(
      (totalChecks / 20) * FORECAST_DEFAULTS.CONFIDENCE_MAX,
      FORECAST_DEFAULTS.CONFIDENCE_MAX,
    );

    let prediction: "warning" | "critical" | "normal" = "normal";
    if (consecutiveFailures >= 5) {
      prediction = "critical";
    } else if (consecutiveFailures >= 3) {
      prediction = "warning";
    }

    const validUntil = new Date(Date.now() + 60 * 60 * 1000);

    results.push({
      entityType: "endpoint",
      entityId: ep.id,
      metric: "downtime",
      prediction,
      confidence,
      timeHorizon: "1h",
      currentValue: consecutiveFailures,
      predictedValue: failureRate * 100,
      threshold: prediction === "critical" ? 5 : prediction === "warning" ? 3 : null,
      reasoning:
        prediction === "normal"
          ? `Endpoint stable with ${consecutiveFailures} consecutive failures`
          : `${consecutiveFailures} consecutive failures detected, downtime likely`,
      validUntil,
    });
  }

  return results;
}

export async function forecastUnbondingRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const validators = await prisma.validator.findMany({
    include: {
      delegationSnapshots: {
        where: { timestamp: { gte: sevenDaysAgo } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  for (const val of validators) {
    if (val.delegationSnapshots.length < 2) continue;

    const snapshots = val.delegationSnapshots;
    const firstDelegated = Number(BigInt(snapshots[0].totalDelegated));
    const lastDelegated = Number(
      BigInt(snapshots[snapshots.length - 1].totalDelegated),
    );

    if (firstDelegated === 0) continue;

    const changePct = ((lastDelegated - firstDelegated) / firstDelegated) * 100;
    const confidence = Math.min(
      (snapshots.length / 10) * FORECAST_DEFAULTS.CONFIDENCE_MAX,
      FORECAST_DEFAULTS.CONFIDENCE_MAX,
    );

    let prediction: "warning" | "critical" | "normal" = "normal";
    let threshold: number | null = null;
    if (changePct <= -25) {
      prediction = "critical";
      threshold = -25;
    } else if (changePct <= -10) {
      prediction = "warning";
      threshold = -10;
    }

    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    results.push({
      entityType: "validator",
      entityId: val.id,
      metric: "unbonding",
      prediction,
      confidence,
      timeHorizon: "24h",
      currentValue: lastDelegated,
      predictedValue: changePct,
      threshold,
      reasoning:
        prediction === "normal"
          ? `Delegation flow stable for ${val.moniker} (${changePct.toFixed(1)}%)`
          : `Delegation outflow of ${Math.abs(changePct).toFixed(1)}% detected for ${val.moniker}`,
      validUntil,
    });
  }

  return results;
}

export async function forecastSloBreachRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];

  const slos = await prisma.slo.findMany({
    where: { isActive: true },
    include: {
      evaluations: {
        orderBy: { evaluatedAt: "desc" },
        take: 10,
      },
    },
  });

  for (const slo of slos) {
    if (slo.evaluations.length < 2) continue;

    const evals = [...slo.evaluations].reverse(); // oldest first
    const startTime = evals[0].evaluatedAt.getTime();
    const points = evals.map((e) => ({
      x: (e.evaluatedAt.getTime() - startTime) / 3600000, // hours
      y: e.budgetConsumed,
    }));

    const { slope, r2 } = linearRegression(points);
    const confidence = Math.min(r2 * 100, FORECAST_DEFAULTS.CONFIDENCE_MAX);
    const currentBudget = evals[evals.length - 1].budgetConsumed;
    const remaining = 100 - currentBudget;

    let prediction: "warning" | "critical" | "normal" = "normal";
    let threshold: number | null = null;

    if (slope > 0 && remaining > 0) {
      const hoursToExhaustion = remaining / slope;
      if (hoursToExhaustion <= 6) {
        prediction = "critical";
        threshold = 6;
      } else if (hoursToExhaustion <= 24) {
        prediction = "warning";
        threshold = 24;
      }
    }

    const validUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);

    results.push({
      entityType: slo.entityType,
      entityId: slo.entityId,
      metric: "breach_risk",
      prediction,
      confidence,
      timeHorizon: "6h",
      currentValue: currentBudget,
      predictedValue: currentBudget + slope * 6,
      threshold,
      reasoning:
        prediction === "normal"
          ? `SLO "${slo.name}" budget burn rate is sustainable`
          : `SLO "${slo.name}" budget projected to exhaust within ${slope > 0 ? Math.round((100 - currentBudget) / slope) : "N/A"}h at current burn rate`,
      validUntil,
    });
  }

  return results;
}

export async function generateForecasts(): Promise<{
  generated: number;
  duration: number;
}> {
  const start = Date.now();

  const [latency, jailRisk, downtime, unbonding, breachRisk] =
    await Promise.all([
      forecastEndpointLatency(),
      forecastJailRisk(),
      forecastDowntimeRisk(),
      forecastUnbondingRisk(),
      forecastSloBreachRisk(),
    ]);

  const allForecasts: ForecastResult[] = [
    ...latency,
    ...jailRisk,
    ...downtime,
    ...unbonding,
    ...breachRisk,
  ];

  if (allForecasts.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Delete expired forecasts first
      await tx.forecast.deleteMany({
        where: { validUntil: { lt: new Date() } },
      });

      // Bulk create new forecasts
      await tx.forecast.createMany({
        data: allForecasts.map((f) => ({
          entityType: f.entityType,
          entityId: f.entityId,
          metric: f.metric,
          prediction: f.prediction,
          confidence: f.confidence,
          timeHorizon: f.timeHorizon,
          currentValue: f.currentValue,
          predictedValue: f.predictedValue,
          threshold: f.threshold,
          reasoning: f.reasoning,
          validUntil: f.validUntil,
        })),
      });
    });
  }

  return {
    generated: allForecasts.length,
    duration: Date.now() - start,
  };
}

export async function getForecasts(filters?: {
  entityType?: string;
  entityId?: string;
  metric?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  forecasts: Array<{
    id: string;
    entityType: string;
    entityId: string;
    metric: string;
    prediction: string;
    confidence: number;
    timeHorizon: string;
    currentValue: number;
    predictedValue: number;
    threshold: number | null;
    reasoning: string;
    validUntil: Date;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = {
    validUntil: { gte: new Date() },
  };
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.entityId) where.entityId = filters.entityId;
  if (filters?.metric) where.metric = filters.metric;

  const limit = Math.min(
    filters?.limit ?? FORECAST_DEFAULTS.DEFAULT_LIMIT,
    FORECAST_DEFAULTS.MAX_LIMIT,
  );
  const offset = Math.max(0, filters?.offset ?? 0);

  const [forecasts, total] = await Promise.all([
    prisma.forecast.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.forecast.count({ where }),
  ]);

  return { forecasts, total };
}
