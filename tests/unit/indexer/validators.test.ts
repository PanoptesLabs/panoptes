import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    validatorSnapshot: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger (used by fetchPaginated)
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { syncValidators } from "@/lib/indexer/validators";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

function makeChainValidator(overrides: Record<string, unknown> = {}) {
  return {
    operator_address: "raivaloper1abc",
    description: { moniker: "TestValidator" },
    status: "BOND_STATUS_BONDED",
    tokens: "1000000",
    commission: { commission_rates: { rate: "0.050000000000000000" } },
    jailed: false,
    ...overrides,
  };
}

function makeDbValidator(overrides = {}) {
  return {
    id: "raivaloper1abc",
    moniker: "TestValidator",
    status: "BOND_STATUS_BONDED",
    tokens: "1000000",
    commission: 0.05,
    jailed: false,
    votingPower: "1000000",
    uptime: 0,
    missedBlocks: 0,
    jailCount: 0,
    lastJailedAt: null,
    firstSeen: new Date(),
    lastUpdated: new Date(),
    ...overrides,
  };
}

function mockFetchResponse(validators: unknown[], nextKey: string | null = null) {
  return {
    ok: true,
    json: async () => ({
      validators,
      pagination: { next_key: nextKey },
    }),
  };
}

describe("syncValidators", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: { upsert: vi.fn() },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("syncs new validators and creates snapshots", async () => {
    const val = makeChainValidator();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([]);

    const result = await syncValidators();

    expect(result.synced).toBe(1);
    expect(result.newValidators).toBe(1);
    expect(result.snapshotsCreated).toBe(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("skips snapshot when data is unchanged", async () => {
    const val = makeChainValidator();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators();

    expect(result.synced).toBe(1);
    expect(result.snapshotsCreated).toBe(0);
    expect(result.newValidators).toBe(0);
  });

  it("creates snapshot when tokens change", async () => {
    const val = makeChainValidator({ tokens: "2000000" });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators();

    expect(result.snapshotsCreated).toBe(1);
  });

  it("forces daily snapshot when option is set", async () => {
    const val = makeChainValidator();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators({ forceDailySnapshot: true });

    expect(result.snapshotsCreated).toBe(1);
  });

  it("tracks jail count when validator becomes jailed", async () => {
    const val = makeChainValidator({ jailed: true });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([
      makeDbValidator({ jailed: false, jailCount: 0 }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let upsertData: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: {
            upsert: vi.fn().mockImplementation((args: unknown) => {
              upsertData = args;
            }),
          },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });

    await syncValidators();

    expect(upsertData.update.jailCount).toBe(1);
  });

  it("throws when validator fetch returns 0 results", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([]));
    mockPrisma.validator.findMany.mockResolvedValue([]);

    await expect(syncValidators()).rejects.toThrow("Validator fetch returned 0 results");
  });

  it("throws on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    mockPrisma.validator.findMany.mockResolvedValue([]);

    await expect(syncValidators()).rejects.toThrow("Failed to sync validators");
  });

  it("throws on HTTP error (0 results after graceful degradation)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });
    mockPrisma.validator.findMany.mockResolvedValue([]);

    await expect(syncValidators()).rejects.toThrow("Validator fetch returned 0 results");
  });

  it("parses commission string to float", async () => {
    const val = makeChainValidator({
      commission: { commission_rates: { rate: "0.100000000000000000" } },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(mockFetchResponse([val]));
    mockPrisma.validator.findMany.mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let upsertData: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: {
            upsert: vi.fn().mockImplementation((args: unknown) => {
              upsertData = args;
            }),
          },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });

    await syncValidators();

    expect(upsertData.create.commission).toBe(0.1);
  });

  it("paginates across multiple pages to fetch all validators", async () => {
    const page1 = Array.from({ length: 200 }, (_, i) =>
      makeChainValidator({ operator_address: `raivaloper1page1_${i}` }),
    );
    const page2 = Array.from({ length: 200 }, (_, i) =>
      makeChainValidator({ operator_address: `raivaloper1page2_${i}` }),
    );
    const page3 = Array.from({ length: 60 }, (_, i) =>
      makeChainValidator({ operator_address: `raivaloper1page3_${i}` }),
    );

    const mockFn = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(page1, "page2key"))
      .mockResolvedValueOnce(mockFetchResponse(page2, "page3key"))
      .mockResolvedValueOnce(mockFetchResponse(page3, null));
    globalThis.fetch = mockFn;

    mockPrisma.validator.findMany.mockResolvedValue([]);

    const result = await syncValidators();

    expect(result.synced).toBe(460);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
