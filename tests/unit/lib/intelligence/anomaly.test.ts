import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: { findMany: vi.fn() },
    endpoint: { findMany: vi.fn() },
    anomaly: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    outboxEvent: { create: vi.fn().mockResolvedValue({ seq: 1 }) },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn().mockResolvedValue(1),
  publishEvents: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import {
  detectAnomalies,
  detectJailing,
  detectLargeStakeChange,
  detectCommissionSpike,
  detectEndpointDown,
  detectBlockStale,
  detectMassUnbonding,
} from "@/lib/intelligence/anomaly";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();

describe("detectJailing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("creates anomaly when validator becomes jailed", async () => {
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "1000000",
        jailed: true,
        snapshots: [
          { jailed: true, tokens: "1000000", commission: 0.05, timestamp: now },
          { jailed: false, tokens: "1000000", commission: 0.05, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectJailing(validators as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "jailing",
          severity: "high",
          entityType: "validator",
          entityId: "val1",
        }),
      }),
    );
  });

  it("skips duplicate anomaly for already jailed validator", async () => {
    mockPrisma.anomaly.findFirst.mockResolvedValue({ id: "existing" });
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "1000000",
        jailed: true,
        snapshots: [
          { jailed: true, tokens: "1000000", commission: 0.05, timestamp: now },
          { jailed: false, tokens: "1000000", commission: 0.05, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectJailing(validators as never);
    expect(result.detected).toBe(0);
    expect(mockPrisma.anomaly.create).not.toHaveBeenCalled();
  });
});

describe("detectLargeStakeChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("detects >10% stake change as high severity", async () => {
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "1200000",
        jailed: false,
        snapshots: [
          { tokens: "1200000", commission: 0.05, jailed: false, timestamp: now },
          { tokens: "1000000", commission: 0.05, jailed: false, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectLargeStakeChange(validators as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "high" }),
      }),
    );
  });

  it("detects >30% stake change as critical severity", async () => {
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "500000",
        jailed: false,
        snapshots: [
          { tokens: "500000", commission: 0.05, jailed: false, timestamp: now },
          { tokens: "1000000", commission: 0.05, jailed: false, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectLargeStakeChange(validators as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "critical" }),
      }),
    );
  });

  it("ignores <10% stake change", async () => {
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "1050000",
        jailed: false,
        snapshots: [
          { tokens: "1050000", commission: 0.05, jailed: false, timestamp: now },
          { tokens: "1000000", commission: 0.05, jailed: false, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectLargeStakeChange(validators as never);
    expect(result.detected).toBe(0);
  });
});

describe("detectCommissionSpike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("detects >5% commission change as medium severity", async () => {
    const validators = [
      {
        id: "val1",
        moniker: "TestVal",
        tokens: "1000000",
        jailed: false,
        snapshots: [
          { commission: 0.15, tokens: "1000000", jailed: false, timestamp: now },
          { commission: 0.05, tokens: "1000000", jailed: false, timestamp: new Date(Date.now() - 60000) },
        ],
      },
    ];

    const result = await detectCommissionSpike(validators as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "medium", type: "commission_spike" }),
      }),
    );
  });
});

describe("detectEndpointDown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("detects 3+ consecutive failures", async () => {
    const endpoints = [
      {
        id: "ep1",
        url: "https://rpc.test.io",
        type: "rpc",
        isOfficial: false,
        isActive: true,
        healthChecks: [
          { isHealthy: false, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
        ],
      },
    ];

    const result = await detectEndpointDown(endpoints as never);
    expect(result.detected).toBe(1);
  });

  it("sets critical severity for official endpoints", async () => {
    const endpoints = [
      {
        id: "ep1",
        url: "https://rpc.republicai.io",
        type: "rpc",
        isOfficial: true,
        isActive: true,
        healthChecks: [
          { isHealthy: false, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
        ],
      },
    ];

    const result = await detectEndpointDown(endpoints as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "critical" }),
      }),
    );
  });

  it("resolves anomaly when endpoint recovers", async () => {
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 1 });
    const endpoints = [
      {
        id: "ep1",
        url: "https://rpc.test.io",
        type: "rpc",
        isOfficial: false,
        isActive: true,
        healthChecks: [
          { isHealthy: true, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
          { isHealthy: false, blockHeight: null, timestamp: now },
        ],
      },
    ];

    const result = await detectEndpointDown(endpoints as never);
    expect(result.detected).toBe(0);
    expect(result.resolved).toBe(1);
  });
});

describe("detectBlockStale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("detects endpoint 10+ blocks behind", async () => {
    const endpoints = [
      {
        id: "ep1",
        isActive: true,
        isOfficial: false,
        url: "https://rpc.test.io",
        type: "rpc",
        healthChecks: [{ blockHeight: BigInt(1000), isHealthy: true, timestamp: now }],
      },
      {
        id: "ep2",
        isActive: true,
        isOfficial: false,
        url: "https://rpc2.test.io",
        type: "rpc",
        healthChecks: [{ blockHeight: BigInt(985), isHealthy: true, timestamp: now }],
      },
    ];

    const result = await detectBlockStale(endpoints as never);
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "block_stale", entityId: "ep2" }),
      }),
    );
  });
});

describe("detectMassUnbonding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
  });

  it("detects >5% unbonding as critical", async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ total: "1000000" }])   // total tokens
      .mockResolvedValueOnce([{ total: "60000" }]);     // unbonding tokens

    const result = await detectMassUnbonding();
    expect(result.detected).toBe(1);
    expect(mockPrisma.anomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "critical", type: "mass_unbonding" }),
      }),
    );
  });
});

describe("detectAnomalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.anomaly.findFirst.mockResolvedValue(null);
    mockPrisma.anomaly.create.mockResolvedValue({});
    mockPrisma.anomaly.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.validator.findMany.mockResolvedValue([]);
    mockPrisma.endpoint.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([{ total: "0" }]);
  });

  it("runs all detectors and returns totals", async () => {
    const result = await detectAnomalies();
    expect(result.detected).toBeGreaterThanOrEqual(0);
    expect(result.resolved).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
