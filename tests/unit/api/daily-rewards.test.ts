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

describe("GET /api/stats/daily-rewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns daily rewards data", async () => {
    const mockData = [
      { date: "2026-02-10", total_rewards: "337116305571413198954773.484", total_commission: "34168211259089522314152.485" },
      { date: "2026-02-09", total_rewards: "320000000000000000000000.000", total_commission: "32000000000000000000000.000" },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/stats/daily-rewards/route");
    const req = new NextRequest("http://localhost/api/stats/daily-rewards");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].date).toBe("2026-02-10");
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/stats/daily-rewards/route");
    const req = new NextRequest("http://localhost/api/stats/daily-rewards");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when yaci returns no data", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/daily-rewards/route");
    const req = new NextRequest("http://localhost/api/stats/daily-rewards");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
