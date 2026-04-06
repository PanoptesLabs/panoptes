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

describe("GET /api/stats/block-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns block metrics array", async () => {
    const mockData = [
      { height: 482001, block_time: "2026-02-25T06:09:50Z", tx_count: 5, gas_used: 1000, total_rewards: "100", total_commission: "10", validator_count: 91, created_at: "2026-02-25T06:10:00Z" },
      { height: 482000, block_time: "2026-02-25T06:09:45Z", tx_count: 3, gas_used: 800, total_rewards: "90", total_commission: "9", validator_count: 91, created_at: "2026-02-25T06:09:55Z" },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/stats/block-metrics/route");
    const req = new NextRequest("http://localhost/api/stats/block-metrics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].height).toBe(482001);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "http" });

    const { GET } = await import("@/app/api/stats/block-metrics/route");
    const req = new NextRequest("http://localhost/api/stats/block-metrics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when yaci returns no data", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/block-metrics/route");
    const req = new NextRequest("http://localhost/api/stats/block-metrics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
