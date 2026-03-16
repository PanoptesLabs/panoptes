import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const forecastModel = {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  return {
    prisma: {
      endpoint: { findMany: vi.fn() },
      validator: { findMany: vi.fn() },
      slo: { findMany: vi.fn() },
      forecast: forecastModel,
      $transaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          forecast: forecastModel,
        });
      }),
    },
  };
});

import { prisma } from "@/lib/db";
import {
  linearRegression,
  forecastEndpointLatency,
  forecastJailRisk,
  forecastDowntimeRisk,
  forecastUnbondingRisk,
  forecastSloBreachRisk,
  generateForecasts,
  getForecasts,
} from "@/lib/intelligence/forecasting";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("linearRegression", () => {
  it("computes correct slope and intercept for known data", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(2);
    expect(result.intercept).toBeCloseTo(0);
    expect(result.r2).toBeCloseTo(1);
  });

  it("returns zero slope for single point", () => {
    const result = linearRegression([{ x: 1, y: 5 }]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(5);
    expect(result.r2).toBe(0);
  });

  it("returns r2=0 for flat data", () => {
    const points = [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(0);
    expect(result.r2).toBe(0);
  });

  it("returns zero slope for empty array", () => {
    const result = linearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.r2).toBe(0);
  });

  it("handles negative slope correctly", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 8 },
      { x: 2, y: 6 },
      { x: 3, y: 4 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(-2);
    expect(result.intercept).toBeCloseTo(10);
    expect(result.r2).toBeCloseTo(1);
  });

  it("handles two points correctly", () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(2);
    expect(result.intercept).toBeCloseTo(1);
    expect(result.r2).toBeCloseTo(1);
  });
});

describe("forecastEndpointLatency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forecasts for endpoints with increasing latency", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        healthChecks: [
          { latencyMs: 200, isHealthy: true, timestamp: hoursAgo(3) },
          { latencyMs: 3000, isHealthy: true, timestamp: hoursAgo(2) },
          { latencyMs: 6000, isHealthy: true, timestamp: hoursAgo(1) },
          { latencyMs: 9000, isHealthy: true, timestamp: now },
        ],
      },
    ]);

    const results = await forecastEndpointLatency();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metric).toBe("latency");
    expect(results[0].entityType).toBe("endpoint");
  });

  it("skips endpoints with fewer than 3 healthy checks", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        healthChecks: [
          { latencyMs: 100, isHealthy: true, timestamp: hoursAgo(1) },
          { latencyMs: 200, isHealthy: false, timestamp: now },
        ],
      },
    ]);

    const results = await forecastEndpointLatency();
    expect(results).toHaveLength(0);
  });
});

describe("forecastJailRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects increasing missed blocks", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      {
        id: "val1",
        moniker: "TestVal",
        missedBlocks: 100,
        jailed: false,
        snapshots: [
          { timestamp: hoursAgo(48) },
          { timestamp: hoursAgo(24) },
          { timestamp: now },
        ],
      },
    ]);

    const results = await forecastJailRisk();
    expect(results.length).toBe(1);
    expect(results[0].metric).toBe("jail_risk");
    expect(results[0].entityType).toBe("validator");
  });

  it("skips validators with insufficient snapshots", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      {
        id: "val1",
        moniker: "TestVal",
        missedBlocks: 0,
        jailed: false,
        snapshots: [{ timestamp: now }],
      },
    ]);

    const results = await forecastJailRisk();
    expect(results).toHaveLength(0);
  });
});

describe("forecastDowntimeRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects consecutive failures", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        healthChecks: [
          { isHealthy: false, timestamp: hoursAgo(0) },
          { isHealthy: false, timestamp: hoursAgo(1) },
          { isHealthy: false, timestamp: hoursAgo(2) },
          { isHealthy: false, timestamp: hoursAgo(3) },
          { isHealthy: false, timestamp: hoursAgo(4) },
          { isHealthy: true, timestamp: hoursAgo(5) },
        ],
      },
    ]);

    const results = await forecastDowntimeRisk();
    expect(results.length).toBe(1);
    expect(results[0].prediction).toBe("critical");
    expect(results[0].metric).toBe("downtime");
  });

  it("returns normal for healthy endpoints", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        healthChecks: [
          { isHealthy: true, timestamp: hoursAgo(0) },
          { isHealthy: true, timestamp: hoursAgo(1) },
          { isHealthy: true, timestamp: hoursAgo(2) },
        ],
      },
    ]);

    const results = await forecastDowntimeRisk();
    expect(results.length).toBe(1);
    expect(results[0].prediction).toBe("normal");
  });
});

describe("forecastUnbondingRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects delegation outflow", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      {
        id: "val1",
        moniker: "TestVal",
        delegationSnapshots: [
          { totalDelegated: "1000000", timestamp: hoursAgo(48) },
          { totalDelegated: "700000", timestamp: now },
        ],
      },
    ]);

    const results = await forecastUnbondingRisk();
    expect(results.length).toBe(1);
    expect(results[0].prediction).toBe("critical");
    expect(results[0].metric).toBe("unbonding");
  });

  it("returns normal for stable delegations", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      {
        id: "val1",
        moniker: "TestVal",
        delegationSnapshots: [
          { totalDelegated: "1000000", timestamp: hoursAgo(48) },
          { totalDelegated: "990000", timestamp: now },
        ],
      },
    ]);

    const results = await forecastUnbondingRisk();
    expect(results.length).toBe(1);
    expect(results[0].prediction).toBe("normal");
  });
});

describe("forecastSloBreachRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects budget burn rate", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      {
        id: "slo1",
        name: "Uptime SLO",
        entityType: "endpoint",
        entityId: "ep1",
        evaluations: [
          { budgetConsumed: 90, evaluatedAt: hoursAgo(6) },
          { budgetConsumed: 80, evaluatedAt: hoursAgo(12) },
          { budgetConsumed: 70, evaluatedAt: hoursAgo(18) },
        ],
      },
    ]);

    const results = await forecastSloBreachRisk();
    expect(results.length).toBe(1);
    expect(results[0].metric).toBe("breach_risk");
    expect(["warning", "critical"]).toContain(results[0].prediction);
  });

  it("skips SLOs with insufficient evaluations", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      {
        id: "slo1",
        name: "Uptime SLO",
        entityType: "endpoint",
        entityId: "ep1",
        evaluations: [{ budgetConsumed: 50, evaluatedAt: now }],
      },
    ]);

    const results = await forecastSloBreachRisk();
    expect(results).toHaveLength(0);
  });
});

describe("generateForecasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.endpoint.findMany.mockResolvedValue([]);
    mockPrisma.validator.findMany.mockResolvedValue([]);
    mockPrisma.slo.findMany.mockResolvedValue([]);
    mockPrisma.forecast.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.forecast.createMany.mockResolvedValue({ count: 0 });
  });

  it("calls all forecast functions and returns count", async () => {
    const result = await generateForecasts();
    expect(result).toHaveProperty("generated");
    expect(result).toHaveProperty("duration");
    expect(result.generated).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("creates forecasts when data is available", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        healthChecks: [
          { latencyMs: 100, isHealthy: true, timestamp: hoursAgo(3) },
          { latencyMs: 200, isHealthy: true, timestamp: hoursAgo(2) },
          { latencyMs: 300, isHealthy: true, timestamp: hoursAgo(1) },
        ],
      },
    ]);

    const result = await generateForecasts();
    expect(result.generated).toBeGreaterThan(0);
    expect(mockPrisma.forecast.createMany).toHaveBeenCalled();
  });
});

describe("getForecasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns filtered results", async () => {
    const mockForecasts = [
      {
        id: "f1",
        entityType: "endpoint",
        entityId: "ep1",
        metric: "latency",
        prediction: "warning",
        confidence: 85,
        timeHorizon: "1h",
        currentValue: 3000,
        predictedValue: 7000,
        threshold: 5000,
        reasoning: "Test",
        validUntil: new Date(Date.now() + 3600000),
        createdAt: now,
      },
    ];
    mockPrisma.forecast.findMany.mockResolvedValue(mockForecasts);
    mockPrisma.forecast.count.mockResolvedValue(1);

    const result = await getForecasts({ metric: "latency" });
    expect(result.forecasts).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("respects limit parameter", async () => {
    mockPrisma.forecast.findMany.mockResolvedValue([]);
    mockPrisma.forecast.count.mockResolvedValue(0);

    await getForecasts({ limit: 5 });
    expect(mockPrisma.forecast.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("caps limit at MAX_LIMIT", async () => {
    mockPrisma.forecast.findMany.mockResolvedValue([]);
    mockPrisma.forecast.count.mockResolvedValue(0);

    await getForecasts({ limit: 500 });
    expect(mockPrisma.forecast.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
