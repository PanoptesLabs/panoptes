import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("republic-sdk", () => ({
  addressToBytes: vi.fn((addr: string) => {
    // Simulate bech32 decode: reject addresses that don't look valid
    if (addr.includes("invalid") || addr.includes("bad")) {
      throw new Error("Invalid checksum");
    }
    return new Uint8Array(20);
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    endpointScore: { findFirst: vi.fn() },
    endpoint: { findFirst: vi.fn() },
    validator: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>, status = 200, options?: { cache?: boolean }) => {
      void options;
      return NextResponse.json(data, { status, headers });
    }),
  };
});

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("POST /api/preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  it("returns preflight result with valid body", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({
        from: "rai1abc...",
        to: "rai1def...",
        amount: "1000000",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.overall).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.length).toBeGreaterThan(0);
    expect(body.timestamp).toBeDefined();
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({ from: "rai1abc..." }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("includes validator check when validatorAddress provided", async () => {
    mockPrisma.validator.findUnique.mockResolvedValue({
      id: "val1",
      moniker: "TestVal",
      jailed: false,
      status: "BOND_STATUS_BONDED",
      scores: [{ score: 80 }],
    });

    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({
        from: "rai1abc...",
        to: "rai1def...",
        amount: "1000000",
        validatorAddress: "val1",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    const validatorCheck = body.checks.find(
      (c: { name: string }) => c.name === "validator_status",
    );
    expect(validatorCheck).toBeDefined();
    expect(validatorCheck.status).toBe("pass");
  });

  it("returns 400 for non-numeric amount", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({
        from: "rai1abc...",
        to: "rai1def...",
        amount: "not-a-number",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid amount");
  });

  it("returns 400 for invalid address format", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({
        from: "cosmos1abc...",
        to: "rai1def...",
        amount: "1000000",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid from address");
  });

  it("returns 400 for invalid bech32 checksum", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: JSON.stringify({
        from: "rai1invalidchecksum",
        to: "rai1def...",
        amount: "1000000",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("bech32 checksum");
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/preflight/route");
    const req = new NextRequest("http://localhost/api/preflight", {
      method: "POST",
      body: "invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
