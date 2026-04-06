import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>, status = 200) =>
      NextResponse.json(data, { status, headers }),
    ),
  };
});

vi.mock("@/lib/yaci", () => ({
  fetchYaci: vi.fn(),
}));

vi.mock("republic-sdk", () => ({
  addressToBytes: vi.fn((addr: string) => {
    if (!addr.startsWith("raivaloper1")) throw new Error("Invalid bech32");
    return new Uint8Array([1, 2, 3]);
  }),
}));

import { fetchYaci } from "@/lib/yaci";

describe("GET /api/validators/[id]/signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns signing stats and uses correct URL with operator_address filter", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [{
        consensus_address: "00787E83EEC225760B28138437622B2D0ADE32DD",
        operator_address: "raivaloper1abc",
        total_blocks: 10000,
        blocks_signed: 9944,
        blocks_missed: 56,
        signing_percentage: 99.44,
        last_height: 926121,
      }],
    });

    const { GET } = await import("@/app/api/validators/[id]/signing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/signing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.signing_percentage).toBe(99.44);
    expect(body.blocks_signed).toBe(9944);

    // Assert the correct URL was called with operator_address filter
    expect(vi.mocked(fetchYaci)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchYaci).mock.calls[0][0]).toBe(
      "/mv_validator_signing_stats?operator_address=eq.raivaloper1abc",
    );
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "network" });

    const { GET } = await import("@/app/api/validators/[id]/signing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/signing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns 400 for invalid validator address", async () => {
    const { GET } = await import("@/app/api/validators/[id]/signing/route");
    const req = new NextRequest("http://localhost/api/validators/INVALID/signing");
    const res = await GET(req, { params: Promise.resolve({ id: "INVALID" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
    expect(vi.mocked(fetchYaci)).not.toHaveBeenCalled();
  });

  it("returns null when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/validators/[id]/signing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/signing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
