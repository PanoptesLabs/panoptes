import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      findMany: vi.fn(),
    },
    endpointHealth: {
      findMany: vi.fn(),
    },
    anomaly: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { computeNetworkHealthScore } from "@/lib/intelligence/scoring";
import type { NetworkHealthInput } from "@/lib/intelligence/scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

function makeValidator(overrides: { status?: string; jailed?: boolean; uptime?: number } = {}) {
  return { status: "BOND_STATUS_BONDED", jailed: false, uptime: 0.99, ...overrides };
}

function makeHealthCheck(isHealthy: boolean) {
  return { isHealthy };
}

describe("computeNetworkHealthScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a score between 0 and 100", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.7,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 8,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator(),
      makeValidator({ uptime: 0.98 }),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(true),
      makeHealthCheck(true),
      makeHealthCheck(false),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(2);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(typeof score).toBe("number");
  });

  it("higher score when all checks healthy and no anomalies", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.85,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 10,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ uptime: 1.0 }),
      makeValidator({ uptime: 0.999 }),
      makeValidator({ uptime: 0.998 }),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(true),
      makeHealthCheck(true),
      makeHealthCheck(true),
      makeHealthCheck(true),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(0);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeGreaterThan(80);
  });

  it("lower score when many anomalies detected", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.7,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 8,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ uptime: 0.95 }),
      makeValidator({ uptime: 0.96 }),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(true),
      makeHealthCheck(true),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(10);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeLessThan(78);
  });

  it("lower score when many endpoints unhealthy", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.7,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 8,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator(),
      makeValidator({ uptime: 0.98 }),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(false),
      makeHealthCheck(false),
      makeHealthCheck(false),
      makeHealthCheck(true),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(2);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeLessThan(75);
  });

  it("uses provided bondedRatio, avgBlockTime, nakamotoCoefficient (not from DB)", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.9,
      avgBlockTime: 3.5,
      nakamotoCoefficient: 15,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator({ status: "BOND_STATUS_UNBONDING", uptime: 0.95 }),
      makeValidator({ status: "BOND_STATUS_UNBONDING", uptime: 0.94 }),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(true),
      makeHealthCheck(true),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(1);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeGreaterThan(70);
    expect(typeof score).toBe("number");
  });

  it("handles empty validator list gracefully", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: null,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 5,
    };

    mockPrisma.validator.findMany.mockResolvedValue([]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      makeHealthCheck(true),
      makeHealthCheck(true),
    ]);
    mockPrisma.anomaly.count.mockResolvedValue(3);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(typeof score).toBe("number");
  });

  it("handles zero endpoint checks", async () => {
    const input: NetworkHealthInput = {
      bondedRatio: 0.7,
      avgBlockTime: 4.0,
      nakamotoCoefficient: 8,
    };

    mockPrisma.validator.findMany.mockResolvedValue([
      makeValidator(),
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(1);

    const score = await computeNetworkHealthScore(input);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(typeof score).toBe("number");
  });
});
