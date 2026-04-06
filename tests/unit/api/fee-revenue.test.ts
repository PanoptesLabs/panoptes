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

describe("GET /api/stats/fee-revenue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fee revenue from first element", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [{ denom: "arai", total_amount: "4540778090507873195492" }],
    });

    const { GET } = await import("@/app/api/stats/fee-revenue/route");
    const req = new NextRequest("http://localhost/api/stats/fee-revenue");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.denom).toBe("arai");
    expect(body.total_amount).toBe("4540778090507873195492");
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "network" });

    const { GET } = await import("@/app/api/stats/fee-revenue/route");
    const req = new NextRequest("http://localhost/api/stats/fee-revenue");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns null when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/fee-revenue/route");
    const req = new NextRequest("http://localhost/api/stats/fee-revenue");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
