import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: { findMany: vi.fn() },
    validatorScore: { findMany: vi.fn() },
    delegationSnapshot: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  getLeaderboard,
  compareValidators,
  getScoreTrend,
} from "@/lib/intelligence/leaderboard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();
const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

function makeValidator(id: string, moniker: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    moniker,
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
    scores: [],
    delegationSnapshots: [],
    ...overrides,
  };
}

function makeScore(score: number, overrides: Record<string, unknown> = {}) {
  return {
    id: "score1",
    validatorId: "val1",
    score,
    missedBlockRate: 0.01,
    jailPenalty: 0,
    stakeStability: 0.95,
    commissionScore: 0.9,
    governanceScore: 0.8,
    timestamp: now,
    ...overrides,
  };
}

describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overall leaderboard sorted by score DESC", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", { scores: [makeScore(90, { validatorId: "v1" })] }),
      makeValidator("v2", "Beta", { scores: [makeScore(80, { validatorId: "v2" })] }),
      makeValidator("v3", "Gamma", { scores: [makeScore(95, { validatorId: "v3" })] }),
    ]);

    const result = await getLeaderboard("overall", 20);

    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[0].validatorId).toBe("v3");
    expect(result[0].value).toBe(95);
    expect(result[1].rank).toBe(2);
    expect(result[1].validatorId).toBe("v1");
  });

  it("returns uptime leaderboard sorted by (1 - missedBlockRate) DESC", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        scores: [makeScore(80, { missedBlockRate: 0.1, validatorId: "v1" })],
      }),
      makeValidator("v2", "Beta", {
        scores: [makeScore(70, { missedBlockRate: 0.02, validatorId: "v2" })],
      }),
    ]);

    const result = await getLeaderboard("uptime", 20);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v2");
    expect(result[0].value).toBeCloseTo(0.98);
  });

  it("returns commission leaderboard sorted ASC (lower is better)", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        commission: 0.10,
        scores: [makeScore(80, { validatorId: "v1" })],
      }),
      makeValidator("v2", "Beta", {
        commission: 0.03,
        scores: [makeScore(70, { validatorId: "v2" })],
      }),
    ]);

    const result = await getLeaderboard("commission", 20);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v2");
    expect(result[0].value).toBe(0.03);
  });

  it("returns governance leaderboard sorted by governanceScore DESC", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        scores: [makeScore(80, { governanceScore: 0.5, validatorId: "v1" })],
      }),
      makeValidator("v2", "Beta", {
        scores: [makeScore(70, { governanceScore: 0.9, validatorId: "v2" })],
      }),
    ]);

    const result = await getLeaderboard("governance", 20);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v2");
    expect(result[0].value).toBe(0.9);
  });

  it("returns rising leaderboard sorted by score delta DESC", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        scores: [makeScore(90, { validatorId: "v1" })],
      }),
      makeValidator("v2", "Beta", {
        scores: [makeScore(80, { validatorId: "v2" })],
      }),
    ]);

    // Bulk query: v1 old score 70 (delta +20), v2 old score 75 (delta +5)
    mockPrisma.validatorScore.findMany.mockResolvedValueOnce([
      makeScore(70, { validatorId: "v1", timestamp: yesterday }),
      makeScore(75, { validatorId: "v2", timestamp: yesterday }),
    ]);

    const result = await getLeaderboard("rising", 20);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v1");
    expect(result[0].value).toBe(20);
  });

  it("returns stake_magnet leaderboard sorted by delegator delta DESC", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        scores: [makeScore(80, { validatorId: "v1" })],
        delegationSnapshots: [{ totalDelegators: 50, timestamp: now }],
      }),
      makeValidator("v2", "Beta", {
        scores: [makeScore(70, { validatorId: "v2" })],
        delegationSnapshots: [{ totalDelegators: 100, timestamp: now }],
      }),
    ]);

    // Bulk query: v1 old 30 (delta +20), v2 old 90 (delta +10)
    mockPrisma.delegationSnapshot.findMany.mockResolvedValueOnce([
      { validatorId: "v1", totalDelegators: 30, timestamp: weekAgo },
      { validatorId: "v2", totalDelegators: 90, timestamp: weekAgo },
    ]);

    const result = await getLeaderboard("stake_magnet", 20);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v1");
    expect(result[0].value).toBe(20);
  });

  it("returns empty array when no data", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([]);

    const result = await getLeaderboard("overall", 20);

    expect(result).toEqual([]);
  });

  it("skips validators without scores", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", { scores: [] }),
      makeValidator("v2", "Beta", { scores: [makeScore(80, { validatorId: "v2" })] }),
    ]);

    const result = await getLeaderboard("overall", 20);

    expect(result).toHaveLength(1);
    expect(result[0].validatorId).toBe("v2");
  });

  it("respects limit parameter", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", { scores: [makeScore(90, { validatorId: "v1" })] }),
      makeValidator("v2", "Beta", { scores: [makeScore(80, { validatorId: "v2" })] }),
      makeValidator("v3", "Gamma", { scores: [makeScore(70, { validatorId: "v3" })] }),
    ]);

    const result = await getLeaderboard("overall", 2);

    expect(result).toHaveLength(2);
  });
});

describe("compareValidators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns metrics for each validator", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        commission: 0.05,
        scores: [makeScore(85, {
          validatorId: "v1",
          missedBlockRate: 0.02,
          governanceScore: 0.7,
          stakeStability: 0.9,
        })],
      }),
      makeValidator("v2", "Beta", {
        commission: 0.10,
        scores: [makeScore(75, {
          validatorId: "v2",
          missedBlockRate: 0.05,
          governanceScore: 0.6,
          stakeStability: 0.8,
        })],
      }),
    ]);

    const result = await compareValidators(["v1", "v2"]);

    expect(result).toHaveLength(2);
    expect(result[0].validatorId).toBe("v1");
    expect(result[0].moniker).toBe("Alpha");
    expect(result[0].metrics.uptime).toBeCloseTo(0.98);
    expect(result[0].metrics.commission).toBe(0.05);
    expect(result[0].metrics.governance).toBe(0.7);
    expect(result[0].metrics.stakeStability).toBe(0.9);
    expect(result[0].metrics.score).toBe(85);
  });

  it("handles missing validators gracefully", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", {
        scores: [makeScore(85, { validatorId: "v1" })],
      }),
    ]);

    const result = await compareValidators(["v1", "nonexistent"]);

    expect(result).toHaveLength(1);
    expect(result[0].validatorId).toBe("v1");
  });

  it("returns zero metrics for validators without scores", async () => {
    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator("v1", "Alpha", { scores: [] }),
    ]);

    const result = await compareValidators(["v1"]);

    expect(result).toHaveLength(1);
    expect(result[0].metrics.uptime).toBe(0);
    expect(result[0].metrics.score).toBe(0);
  });
});

describe("getScoreTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trend points for valid period", async () => {
    const scores = [
      { timestamp: new Date("2026-03-01"), score: 80 },
      { timestamp: new Date("2026-03-08"), score: 85 },
      { timestamp: new Date("2026-03-15"), score: 90 },
    ];
    mockPrisma.validatorScore.findMany.mockResolvedValue(scores);

    const result = await getScoreTrend("v1", "30d");

    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBe(scores[0].timestamp.toISOString());
    expect(result[0].score).toBe(80);
    expect(result[2].score).toBe(90);
  });

  it("returns empty array when no data", async () => {
    mockPrisma.validatorScore.findMany.mockResolvedValue([]);

    const result = await getScoreTrend("v1", "7d");

    expect(result).toEqual([]);
  });

  it("uses correct time range for each period", async () => {
    mockPrisma.validatorScore.findMany.mockResolvedValue([]);

    await getScoreTrend("v1", "7d");

    expect(mockPrisma.validatorScore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          validatorId: "v1",
          timestamp: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });
});
