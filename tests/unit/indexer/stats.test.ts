import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      count: vi.fn(),
    },
    networkStats: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/republic", () => ({
  getRepublicClient: vi.fn(() => ({
    getStatus: vi.fn(),
  })),
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn().mockResolvedValue(1),
  publishEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { aggregateStats } from "@/lib/indexer/stats";
import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetClient = getRepublicClient as any;

function setupValidatorMocks() {
  mockPrisma.validator.count
    .mockResolvedValueOnce(50) // total
    .mockResolvedValueOnce(30); // active (bonded)

  mockPrisma.$queryRaw
    .mockResolvedValueOnce([{ total: "1000000" }]) // bonded tokens
    .mockResolvedValueOnce([{ total: "2000000" }]); // all tokens

  mockPrisma.networkStats.findMany.mockResolvedValue([]);
  mockPrisma.networkStats.findFirst.mockResolvedValue(null);
  mockPrisma.networkStats.create.mockResolvedValue({});
}

describe("aggregateStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetClient.mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        syncInfo: { latestBlockHeight: "100000" },
      }),
    });

    setupValidatorMocks();
  });

  it("aggregates stats from chain and DB", async () => {
    const result = await aggregateStats();

    expect(result.blockHeight).toBe("100000");
    expect(result.blockHeightSource).toBe("rpc");
    expect(result.totalValidators).toBe(50);
    expect(result.activeValidators).toBe(30);
    expect(result.totalStaked).toBe("1000000");
  });

  it("calculates avg block time from last two records", async () => {
    const now = Date.now();
    mockPrisma.networkStats.findMany.mockResolvedValue([
      {
        id: "s1",
        totalValidators: 50,
        activeValidators: 30,
        totalStaked: "1000000",
        bondedRatio: 0.5,
        blockHeight: BigInt(99990),
        avgBlockTime: null,
        timestamp: new Date(now),
      },
      {
        id: "s2",
        totalValidators: 50,
        activeValidators: 30,
        totalStaked: "1000000",
        bondedRatio: 0.5,
        blockHeight: BigInt(99980),
        avgBlockTime: null,
        timestamp: new Date(now - 60000),
      },
    ]);

    const result = await aggregateStats();

    expect(result.blockHeight).toBe("100000");
    expect(mockPrisma.networkStats.create).toHaveBeenCalled();
  });

  it("handles zero total tokens gracefully", async () => {
    mockPrisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([{ total: "0" }]);

    const result = await aggregateStats();

    expect(result.totalStaked).toBe("0");
  });

  it("throws IndexerError on failure", async () => {
    mockGetClient.mockReturnValue({
      getStatus: vi.fn().mockRejectedValue(new Error("Connection failed")),
    });

    // Stub fetch so REST fallback doesn't make real network calls
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    // DB queries also fail to trigger IndexerError
    mockPrisma.validator.count.mockReset().mockRejectedValue(new Error("DB down"));

    await expect(aggregateStats()).rejects.toThrow("Failed to aggregate stats");

    vi.unstubAllGlobals();
  });

  describe("block height fallback", () => {
    it("uses RPC as primary source", async () => {
      const result = await aggregateStats();

      expect(result.blockHeight).toBe("100000");
      expect(result.blockHeightSource).toBe("rpc");
      expect(logger.warn).not.toHaveBeenCalled();
      expect(mockPrisma.networkStats.create).toHaveBeenCalled();
    });

    it("falls back to REST when RPC fails", async () => {
      mockGetClient.mockReturnValue({
        getStatus: vi.fn().mockRejectedValue(new Error("502 Bad Gateway")),
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ block: { header: { height: "200000" } } }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await aggregateStats();

      expect(result.blockHeight).toBe("200000");
      expect(result.blockHeightSource).toBe("rest");
      expect(logger.warn).toHaveBeenCalledWith(
        "aggregateStats",
        "RPC unreachable, trying REST fallback",
      );
      expect(mockPrisma.networkStats.create).toHaveBeenCalled();
      expect(result.totalValidators).toBe(50);

      vi.unstubAllGlobals();
    });

    it("falls back to DB cache when both RPC and REST fail", async () => {
      mockGetClient.mockReturnValue({
        getStatus: vi.fn().mockRejectedValue(new Error("502 Bad Gateway")),
      });

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      mockPrisma.networkStats.findFirst.mockResolvedValue({
        blockHeight: BigInt(150000),
      });

      const result = await aggregateStats();

      expect(result.blockHeight).toBe("150000");
      expect(result.blockHeightSource).toBe("cache");
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(mockPrisma.networkStats.create).toHaveBeenCalled();
      expect(result.totalValidators).toBe(50);

      vi.unstubAllGlobals();
    });

    it("returns 0 when all sources fail and no cache exists", async () => {
      mockGetClient.mockReturnValue({
        getStatus: vi.fn().mockRejectedValue(new Error("502 Bad Gateway")),
      });

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      mockPrisma.networkStats.findFirst.mockResolvedValue(null);

      const result = await aggregateStats();

      expect(result.blockHeight).toBe("0");
      expect(result.blockHeightSource).toBe("cache");
      expect(mockPrisma.networkStats.create).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("skips avgBlockTime calculation when using cached height", async () => {
      mockGetClient.mockReturnValue({
        getStatus: vi.fn().mockRejectedValue(new Error("502 Bad Gateway")),
      });

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      mockPrisma.networkStats.findFirst.mockResolvedValue({
        blockHeight: BigInt(150000),
      });

      await aggregateStats();

      // findMany should NOT be called for avgBlockTime when source is "cache"
      expect(mockPrisma.networkStats.findMany).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
