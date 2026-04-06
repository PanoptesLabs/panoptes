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

describe("GET /api/stats/gas-distribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns gas distribution data", async () => {
    const mockData = [
      { gas_range: "0-100k", count: 119353 },
      { gas_range: "100k-200k", count: 45000 },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/stats/gas-distribution/route");
    const req = new NextRequest("http://localhost/api/stats/gas-distribution");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].gas_range).toBe("0-100k");
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/stats/gas-distribution/route");
    const req = new NextRequest("http://localhost/api/stats/gas-distribution");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when yaci returns no data", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/gas-distribution/route");
    const req = new NextRequest("http://localhost/api/stats/gas-distribution");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
