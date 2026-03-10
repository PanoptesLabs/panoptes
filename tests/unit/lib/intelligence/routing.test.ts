import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    endpoint: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  serializeBigInt: vi.fn((obj: unknown) =>
    JSON.parse(
      JSON.stringify(obj, (_: string, v: unknown) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ),
  ),
}));

import { prisma } from "@/lib/db";
import { selectBestEndpoint, weightedRandomSelect, type ScoredEndpoint } from "@/lib/intelligence/routing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();

function makeDbEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: "ep1",
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
    isActive: true,
    createdAt: now,
    healthChecks: [
      {
        id: "hc1",
        endpointId: "ep1",
        latencyMs: 150,
        statusCode: 200,
        isHealthy: true,
        blockHeight: BigInt(1000),
        error: null,
        timestamp: now,
      },
    ],
    scores: [
      {
        score: 85,
        uptime: 0.99,
        latency: 0.9,
        freshness: 1,
        errorRate: 0.99,
        timestamp: now,
      },
    ],
    ...overrides,
  };
}

function makeScoredEndpoint(overrides: Partial<ScoredEndpoint> = {}): ScoredEndpoint {
  return {
    id: "ep1",
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
    latestCheck: null,
    stats24h: { uptimePercent: 100, avgLatency: 100, checkCount: 10, errorCount: 0 },
    score: { score: 85, uptime: 0.99, latency: 0.9, freshness: 1, errorRate: 0.99, timestamp: now.toISOString() },
    ...overrides,
  };
}

describe("selectBestEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns highest scored endpoint via weighted selection", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeDbEndpoint({ id: "ep1", scores: [{ score: 90, uptime: 0.99, latency: 0.9, freshness: 1, errorRate: 0.99, timestamp: now }] }),
      makeDbEndpoint({ id: "ep2", url: "https://rpc2.test.io", scores: [{ score: 30, uptime: 0.5, latency: 0.5, freshness: 0.5, errorRate: 0.5, timestamp: now }] }),
    ]);

    const result = await selectBestEndpoint("rpc");
    expect(result.strategy).toBe("score_weighted");
    expect(result.endpoint).not.toBeNull();
    expect(result.alternatives).toHaveLength(1);
  });

  it("excludes specified IDs", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeDbEndpoint({ id: "ep2", url: "https://rpc2.test.io" }),
    ]);

    const result = await selectBestEndpoint("rpc", { excludeIds: ["ep1"] });
    expect(result.endpoint?.id).toBe("ep2");
  });

  it("falls back when no scores exist", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeDbEndpoint({ id: "ep1", scores: [] }),
      makeDbEndpoint({ id: "ep2", url: "https://rpc2.test.io", scores: [] }),
    ]);

    const result = await selectBestEndpoint("rpc");
    expect(result.strategy).toBe("fallback");
  });

  it("falls back when all scores below 50", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeDbEndpoint({ id: "ep1", scores: [{ score: 30, uptime: 0.3, latency: 0.3, freshness: 0.3, errorRate: 0.3, timestamp: now }] }),
    ]);

    const result = await selectBestEndpoint("rpc");
    expect(result.strategy).toBe("fallback");
  });

  it("filters by type", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([]);

    await selectBestEndpoint("rest");

    expect(mockPrisma.endpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "rest" }),
      }),
    );
  });

  it("returns null endpoint when no endpoints exist", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([]);

    const result = await selectBestEndpoint("rpc");
    expect(result.endpoint).toBeNull();
    expect(result.alternatives).toHaveLength(0);
    expect(result.strategy).toBe("fallback");
  });

  it("returns strategy name in response", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      makeDbEndpoint(),
    ]);

    const result = await selectBestEndpoint("rpc");
    expect(["score_weighted", "fallback", "random"]).toContain(result.strategy);
  });
});

describe("weightedRandomSelect", () => {
  it("selects from weighted endpoints", () => {
    const endpoints: ScoredEndpoint[] = [
      makeScoredEndpoint({ id: "ep1", score: { score: 90, uptime: 1, latency: 1, freshness: 1, errorRate: 1, timestamp: now.toISOString() } }),
      makeScoredEndpoint({ id: "ep2", score: { score: 10, uptime: 0.1, latency: 0.1, freshness: 0.1, errorRate: 0.1, timestamp: now.toISOString() } }),
    ];

    // Run many times — high score should be selected much more often
    const counts: Record<string, number> = { ep1: 0, ep2: 0 };
    for (let i = 0; i < 1000; i++) {
      const selected = weightedRandomSelect(endpoints);
      counts[selected.id]++;
    }

    // ep1 (90^2=8100) should be selected ~98.8% of the time vs ep2 (10^2=100)
    expect(counts.ep1).toBeGreaterThan(counts.ep2);
    expect(counts.ep1).toBeGreaterThan(900);
  });

  it("handles single endpoint", () => {
    const endpoints: ScoredEndpoint[] = [
      makeScoredEndpoint({ id: "ep1" }),
    ];
    const result = weightedRandomSelect(endpoints);
    expect(result.id).toBe("ep1");
  });

  it("handles null scores gracefully", () => {
    const endpoints: ScoredEndpoint[] = [
      makeScoredEndpoint({ id: "ep1", score: null }),
      makeScoredEndpoint({ id: "ep2", score: null }),
    ];
    // Should not throw — fallback to first
    const result = weightedRandomSelect(endpoints);
    expect(result).toBeDefined();
  });
});
