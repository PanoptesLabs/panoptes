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

describe("GET /api/compute/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stats from first element of yaci array response", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [
        { total_jobs: 2618549, pending_jobs: 773446, completed_jobs: 1624551, failed_jobs: 220548 },
      ],
    });

    const { GET } = await import("@/app/api/compute/stats/route");
    const req = new NextRequest("http://localhost/api/compute/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total_jobs).toBe(2618549);
    expect(body.pending_jobs).toBe(773446);
    expect(body.completed_jobs).toBe(1624551);
    expect(body.failed_jobs).toBe(220548);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/compute/stats/route");
    const req = new NextRequest("http://localhost/api/compute/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns null when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/compute/stats/route");
    const req = new NextRequest("http://localhost/api/compute/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
