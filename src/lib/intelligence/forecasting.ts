import { prisma } from "@/lib/db";
import { FORECAST_DEFAULTS, FORECAST_THRESHOLDS } from "@/lib/constants";
import { hoursAgo, daysAgo } from "@/lib/time";

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

function classifyPrediction(
  value: number,
  warnThreshold: number,
  critThreshold: number,
  mode: "gt" | "lt" = "gt",
): { prediction: "warning" | "critical" | "normal"; threshold: number | null } {
  if (mode === "gt") {
    if (value > critThreshold) return { prediction: "critical", threshold: critThreshold };
    if (value > warnThreshold) return { prediction: "warning", threshold: warnThreshold };
  } else {
    if (value <= critThreshold) return { prediction: "critical", threshold: critThreshold };
    if (value <= warnThreshold) return { prediction: "warning", threshold: warnThreshold };
  }
  return { prediction: "normal", threshold: null };
}

function buildForecastResult(params: {
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
}): ForecastResult {
  return { ...params };
}

interface EndpointWithHealthChecks {
  id: string;
  healthChecks: { timestamp: Date; latencyMs: number; isHealthy: boolean }[];
}

export async function forecastEndpointLatency(
  preloaded?: EndpointWithHealthChecks[],
): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];

  let endpoints: EndpointWithHealthChecks[];
  if (preloaded) {
    endpoints = preloaded;
  } else {
    const twentyFourHoursAgo = hoursAgo(24);
    endpoints = await prisma.endpoint.findMany({
      where: { isActive: true },
      include: {
        healthChecks: {
          where: { timestamp: { gte: twentyFourHoursAgo } },
          orderBy: { timestamp: "asc" },
        },
      },
    });
  }

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

      const { prediction, threshold } = classifyPrediction(
        predictedValue,
        FORECAST_THRESHOLDS.LATENCY_WARNING_MS,
        FORECAST_THRESHOLDS.LATENCY_CRITICAL_MS,
      );

      const validUntil = new Date(
        Date.now() + minutes * 60 * 1000,
      );

      results.push(buildForecastResult({
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
      }));
    }
  }

  return results;
}

export async function forecastJailRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const sevenDaysAgo = daysAgo(7);

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

    const { prediction, threshold } = classifyPrediction(
      predictedRate,
      FORECAST_THRESHOLDS.JAIL_RISK_WARNING,
      FORECAST_THRESHOLDS.JAIL_RISK_CRITICAL,
    );

    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    results.push(buildForecastResult({
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
    }));
  }

  return results;
}

export async function forecastDowntimeRisk(
  preloaded?: EndpointWithHealthChecks[],
): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];

  let endpoints: EndpointWithHealthChecks[];
  if (preloaded) {
    // Downtime check needs desc order (most recent first)
    endpoints = preloaded.map((ep) => ({
      ...ep,
      healthChecks: [...ep.healthChecks].reverse(),
    }));
  } else {
    const twentyFourHoursAgo = hoursAgo(24);
    endpoints = await prisma.endpoint.findMany({
      where: { isActive: true },
      include: {
        healthChecks: {
          where: { timestamp: { gte: twentyFourHoursAgo } },
          orderBy: { timestamp: "desc" },
        },
      },
    });
  }

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
      (totalChecks / FORECAST_THRESHOLDS.MIN_SAMPLE_SIZE) * FORECAST_DEFAULTS.CONFIDENCE_MAX,
      FORECAST_DEFAULTS.CONFIDENCE_MAX,
    );

    let prediction: "warning" | "critical" | "normal" = "normal";
    if (consecutiveFailures >= FORECAST_THRESHOLDS.DOWNTIME_CRITICAL_FAILURES) {
      prediction = "critical";
    } else if (consecutiveFailures >= FORECAST_THRESHOLDS.DOWNTIME_WARNING_FAILURES) {
      prediction = "warning";
    }

    const validUntil = new Date(Date.now() + 60 * 60 * 1000);

    results.push(buildForecastResult({
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
    }));
  }

  return results;
}

export async function forecastUnbondingRisk(): Promise<ForecastResult[]> {
  const results: ForecastResult[] = [];
  const sevenDaysAgo = daysAgo(7);

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

    const { prediction, threshold } = classifyPrediction(
      changePct,
      FORECAST_THRESHOLDS.UNBONDING_WARNING_PCT,
      FORECAST_THRESHOLDS.UNBONDING_CRITICAL_PCT,
      "lt",
    );

    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    results.push(buildForecastResult({
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
    }));
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
      ({ prediction, threshold } = classifyPrediction(
        hoursToExhaustion,
        FORECAST_THRESHOLDS.SLO_BREACH_WARNING_HOURS,
        FORECAST_THRESHOLDS.SLO_BREACH_CRITICAL_HOURS,
        "lt",
      ));
    }

    const validUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);

    results.push(buildForecastResult({
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
    }));
  }

  return results;
}

export async function generateForecasts(): Promise<{
  generated: number;
  duration: number;
}> {
  const start = Date.now();

  // Pre-fetch shared endpoint data (used by both latency and downtime forecasts)
  const twentyFourHoursAgo = hoursAgo(24);
  const endpointsWithHealth = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        where: { timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  const [latency, jailRisk, downtime, unbonding, breachRisk] =
    await Promise.all([
      forecastEndpointLatency(endpointsWithHealth),
      forecastJailRisk(),
      forecastDowntimeRisk(endpointsWithHealth),
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
