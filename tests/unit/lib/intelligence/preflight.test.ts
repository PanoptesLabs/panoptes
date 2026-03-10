import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    endpointScore: { findFirst: vi.fn() },
    endpoint: { findFirst: vi.fn() },
    validator: { findUnique: vi.fn() },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prisma } from "@/lib/db";
import { validatePreflight } from "@/lib/intelligence/preflight";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const defaultParams = {
  from: "rai12rfm0s7qu0v8mwmx54uepea3kx8d2m6vk6xc0x",
  to: "rai1abc...",
  amount: "1000000",
};

describe("validatePreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks — endpoint score is high, account and balance found
    mockPrisma.endpointScore.findFirst.mockResolvedValue({
      score: 90,
      endpoint: { url: "https://rpc.republicai.io" },
    });

    mockPrisma.endpoint.findFirst.mockResolvedValue({
      url: "https://rest.republicai.io",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ denom: "aRAI", amount: "99999999999" }],
      }),
    });
  });

  it("returns overall pass when all checks pass", async () => {
    const result = await validatePreflight(defaultParams);

    expect(result.overall).toBe("pass");
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it("returns fail when balance is insufficient", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ denom: "aRAI", amount: "100" }],
      }),
    });

    const result = await validatePreflight(defaultParams);
    expect(result.overall).toBe("fail");

    const balanceCheck = result.checks.find((c) => c.name === "balance_check");
    expect(balanceCheck?.status).toBe("fail");
  });

  it("returns warn when account not found", async () => {
    // First call: endpointScore.findFirst
    // Second call (for account check): fetch returns 404
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 }) // account check
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [{ denom: "aRAI", amount: "99999999999" }],
        }),
      });

    const result = await validatePreflight(defaultParams);

    const accountCheck = result.checks.find((c) => c.name === "account_exists");
    expect(accountCheck?.status).toBe("warn");
  });

  it("returns warn when endpoint score is low", async () => {
    mockPrisma.endpointScore.findFirst.mockResolvedValue({
      score: 55,
      endpoint: { url: "https://rpc.republicai.io" },
    });

    const result = await validatePreflight(defaultParams);

    const endpointCheck = result.checks.find((c) => c.name === "endpoint_health");
    expect(endpointCheck?.status).toBe("warn");
  });

  it("returns fail when jailed validator provided", async () => {
    mockPrisma.validator.findUnique.mockResolvedValue({
      id: "val1",
      moniker: "JailedVal",
      jailed: true,
      status: "BOND_STATUS_BONDED",
      scores: [],
    });

    const result = await validatePreflight({
      ...defaultParams,
      validatorAddress: "val1",
    });

    const validatorCheck = result.checks.find((c) => c.name === "validator_status");
    expect(validatorCheck?.status).toBe("fail");
    expect(result.overall).toBe("fail");
  });

  it("includes gas estimation check", async () => {
    const result = await validatePreflight(defaultParams);

    const gasCheck = result.checks.find((c) => c.name === "gas_estimation");
    expect(gasCheck?.status).toBe("pass");
  });

  it("returns warn for gas insufficient balance", async () => {
    // Balance covers amount but not gas
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ denom: "aRAI", amount: "1000000" }],
      }),
    });

    const result = await validatePreflight(defaultParams);

    const balanceCheck = result.checks.find((c) => c.name === "balance_check");
    expect(balanceCheck?.status).toBe("warn");
  });

  it("returns warn for unbonding validator", async () => {
    mockPrisma.validator.findUnique.mockResolvedValue({
      id: "val1",
      moniker: "UnbondingVal",
      jailed: false,
      status: "BOND_STATUS_UNBONDING",
      scores: [],
    });

    const result = await validatePreflight({
      ...defaultParams,
      validatorAddress: "val1",
    });

    const validatorCheck = result.checks.find((c) => c.name === "validator_status");
    expect(validatorCheck?.status).toBe("warn");
  });

  it("sets overall warn when 2+ warnings", async () => {
    mockPrisma.endpointScore.findFirst.mockResolvedValue({
      score: 55,
      endpoint: { url: "https://rpc.republicai.io" },
    });

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 }) // account not found
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [{ denom: "aRAI", amount: "99999999999" }],
        }),
      });

    const result = await validatePreflight(defaultParams);
    expect(result.overall).toBe("warn");
  });

  it("sets overall fail when any check fails", async () => {
    mockPrisma.endpointScore.findFirst.mockResolvedValue({
      score: 30,
      endpoint: { url: "https://rpc.republicai.io" },
    });

    const result = await validatePreflight(defaultParams);
    // Endpoint score < 50 -> fail
    expect(result.overall).toBe("fail");
  });

  it("tracks duration", async () => {
    const result = await validatePreflight(defaultParams);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe("number");
  });
});
