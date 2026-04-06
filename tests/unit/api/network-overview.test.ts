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

import { fetchYaci } from "@/lib/yaci";

describe("GET /api/stats/network-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns network overview from first element", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [{
        total_validators: 438,
        active_validators: 91,
        jailed_validators: 103,
        total_bonded_tokens: 34980320554247513499346467,
        total_rewards_24h: 295530.78,
        total_commission_24h: 29932.50,
        avg_block_time: 5.11,
        total_transactions: 40563,
        unique_addresses: 3153,
        max_validators: 100,
      }],
    });

    const { GET } = await import("@/app/api/stats/network-overview/route");
    const req = new NextRequest("http://localhost/api/stats/network-overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total_validators).toBe(438);
    expect(body.active_validators).toBe(91);
    expect(body.avg_block_time).toBe(5.11);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/stats/network-overview/route");
    const req = new NextRequest("http://localhost/api/stats/network-overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns null when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/network-overview/route");
    const req = new NextRequest("http://localhost/api/stats/network-overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
