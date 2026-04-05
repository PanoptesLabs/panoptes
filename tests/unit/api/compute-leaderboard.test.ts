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

describe("GET /api/compute/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps flat array from yaci into { entries } shape", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [
        { target_validator: "raivaloper1abc", moniker: "dipy.me", total_jobs: 1026341, completed_jobs: 473129, success_rate: 46.1 },
        { target_validator: "raivaloper1def", moniker: "alexvnn", total_jobs: 524080, completed_jobs: 440736, success_rate: 84.1 },
      ],
    });

    const { GET } = await import("@/app/api/compute/leaderboard/route");
    const req = new NextRequest("http://localhost/api/compute/leaderboard?limit=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].moniker).toBe("dipy.me");
    expect(body.entries[0].success_rate).toBe(46.1);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "network" });

    const { GET } = await import("@/app/api/compute/leaderboard/route");
    const req = new NextRequest("http://localhost/api/compute/leaderboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty entries when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/compute/leaderboard/route");
    const req = new NextRequest("http://localhost/api/compute/leaderboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toEqual([]);
  });
});
