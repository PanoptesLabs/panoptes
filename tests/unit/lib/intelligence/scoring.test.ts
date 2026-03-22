import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    endpoint: { findMany: vi.fn() },
    endpointScore: { create: vi.fn(), createMany: vi.fn() },
    validator: { findMany: vi.fn() },
    validatorScore: { create: vi.fn(), createMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { computeEndpointScores, computeValidatorScores, clamp, getEmaScore } from "@/lib/intelligence/scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();
const recentTime = new Date(Date.now() - 60 * 60 * 1000);

function makeEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: "ep1",
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
    isActive: true,
    createdAt: now,
    healthChecks: [],
    scores: [],
    ...overrides,
  };
}

function makeHealthCheck(overrides: Record<string, unknown> = {}) {
  return {
    id: "hc1",
    endpointId: "ep1",
    latencyMs: 150,
    statusCode: 200,
    isHealthy: true,
    blockHeight: BigInt(1000),
    error: null,
    timestamp: recentTime,
    ...overrides,
  };
}

function makeValidator(overrides: Record<string, unknown> = {}) {
  return {
    id: "val1",
    moniker: "TestVal",
    status: "BOND_STATUS_BONDED",
    tokens: "1000000",
    commission: 0.05,
    jailed: false,
    uptime: 0.99,
    votingPower: "1000000",
    missedBlocks: 10,
    jailCount: 0,
    lastJailedAt: null,
    firstSeen: now,
    lastUpdated: now,
    snapshots: [],
    scores: [],
    ...overrides,
  };
}

describe("clamp", () => {
  it("clamps value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("getEmaScore", () => {
  it("returns raw score when no previous score", () => {
    expect(getEmaScore(80, null, 0.3)).toBe(80);
  });

  it("applies EMA smoothing when previous score exists", () => {
    const result = getEmaScore(100, 50, 0.3);
    // 0.3 * 100 + 0.7 * 50 = 30 + 35 = 65
    expect(result).toBe(65);
  });
});

describe("computeEndpointScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.endpointScore.create.mockResolvedValue({});
    mockPrisma.endpointScore.createMany.mockResolvedValue({ count: 0 });
  });

  it("scores healthy endpoint with high score", async () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      makeHealthCheck({ id: `hc${i}`, isHealthy: true, latencyMs: 100, blockHeight: BigInt(1000) }),
    );
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ healthChecks: checks }),
    ]);

    const result = await computeEndpointScores();
    expect(result.scored).toBe(1);

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    expect(createCall.score).toBeGreaterThan(80);
    expect(createCall.uptime).toBe(1);
    expect(createCall.errorRate).toBe(1);
  });

  it("scores unhealthy endpoint with low score", async () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      makeHealthCheck({ id: `hc${i}`, isHealthy: false, latencyMs: 5000, blockHeight: BigInt(990) }),
    );
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ healthChecks: checks }),
    ]);

    const result = await computeEndpointScores();
    expect(result.scored).toBe(1);

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    expect(createCall.score).toBeLessThan(30);
    expect(createCall.uptime).toBe(0);
  });

  it("scores endpoint with mixed health proportionally", async () => {
    const checks = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeHealthCheck({ id: `hc${i}`, isHealthy: true, latencyMs: 200, blockHeight: BigInt(1000) }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeHealthCheck({ id: `hcf${i}`, isHealthy: false, latencyMs: 4000, blockHeight: BigInt(1000) }),
      ),
    ];
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ healthChecks: checks }),
    ]);

    const result = await computeEndpointScores();
    expect(result.scored).toBe(1);

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    expect(createCall.uptime).toBe(0.7);
    expect(createCall.score).toBeGreaterThan(40);
    expect(createCall.score).toBeLessThan(90);
  });

  it("scores endpoint with no health data as 0", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ healthChecks: [] }),
    ]);

    await computeEndpointScores();

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    expect(createCall.score).toBe(0);
  });

  it("applies EMA smoothing when previous score exists", async () => {
    const checks = Array.from({ length: 5 }, (_, i) =>
      makeHealthCheck({ id: `hc${i}`, isHealthy: true, latencyMs: 100, blockHeight: BigInt(1000) }),
    );
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({
        healthChecks: checks,
        scores: [{ score: 50, timestamp: new Date() }],
      }),
    ]);

    await computeEndpointScores();

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // EMA: 0.3 * rawScore + 0.7 * 50
    // rawScore is high (all healthy, low latency)
    // So result should be between 50 and rawScore
    expect(createCall.score).toBeGreaterThan(50);
  });

  it("calculates latency normalization correctly", async () => {
    const checks = Array.from({ length: 5 }, (_, i) =>
      makeHealthCheck({ id: `hc${i}`, isHealthy: true, latencyMs: 3000, blockHeight: BigInt(1000) }),
    );
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ healthChecks: checks }),
    ]);

    await computeEndpointScores();

    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // latency at 3000ms should be lower than at 200ms
    expect(createCall.latency).toBeLessThan(0.5);
  });

  it("calculates freshness for stale blocks", async () => {
    const ep1Checks = [
      makeHealthCheck({ id: "hc1", blockHeight: BigInt(1000) }),
    ];
    const ep2Checks = [
      makeHealthCheck({ id: "hc2", endpointId: "ep2", blockHeight: BigInt(980) }),
    ];
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeEndpoint({ id: "ep1", healthChecks: ep1Checks }),
      makeEndpoint({ id: "ep2", healthChecks: ep2Checks }),
    ]);

    await computeEndpointScores();

    // ep2 is 20 blocks behind -> freshness should be 0
    const batchData = mockPrisma.endpointScore.createMany.mock.calls[0][0].data;
    const ep2Call = batchData[1];
    expect(ep2Call.freshness).toBe(0);
  });
});

describe("computeValidatorScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.validatorScore.create.mockResolvedValue({});
    mockPrisma.validatorScore.createMany.mockResolvedValue({ count: 0 });
  });

  it("scores clean validator with high score", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ missedBlocks: 0, commission: 0.05, jailCount: 0 }),
    ]);

    const result = await computeValidatorScores();
    expect(result.scored).toBe(1);

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    expect(createCall.score).toBeGreaterThan(80);
    expect(createCall.missedBlockRate).toBe(1);
    expect(createCall.jailPenalty).toBe(1);
  });

  it("penalizes jailed validator", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({
        jailCount: 2,
        lastJailedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      }),
    ]);

    await computeValidatorScores();

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // jailCount=2 -> 1 - 2*0.25 = 0.5, recent jail -> 0.5 - 0.25 = 0.25
    expect(createCall.jailPenalty).toBe(0.25);
  });

  it("penalizes high missed blocks", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ missedBlocks: 800 }),
    ]);

    await computeValidatorScores();

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // 1 - 800/1000 = 0.2
    expect(createCall.missedBlockRate).toBeCloseTo(0.2);
  });

  it("penalizes high commission", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ commission: 0.25 }),
    ]);

    await computeValidatorScores();

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // 1 - clamp(0.25/0.20, 0, 1) = 1 - 1 = 0
    expect(createCall.commissionScore).toBe(0);
  });

  it("calculates stake stability from snapshot variance", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({
        snapshots: [
          { tokens: "1000000", timestamp: new Date() },
          { tokens: "1000000", timestamp: new Date() },
          { tokens: "1000000", timestamp: new Date() },
        ],
      }),
    ]);

    await computeValidatorScores();

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // No variance = max stability
    expect(createCall.stakeStability).toBe(1);
  });

  it("applies EMA smoothing for validators", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({
        scores: [{ score: 40, timestamp: new Date() }],
      }),
    ]);

    await computeValidatorScores();

    const batchData = mockPrisma.validatorScore.createMany.mock.calls[0][0].data;
    const createCall = batchData[0];
    // Should be between 40 and raw score
    expect(createCall.score).toBeGreaterThan(40);
  });
});
