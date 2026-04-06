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

describe("GET /api/stats/tx-success-rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success rate from first element", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: [{ total: 4779945, successful: 4746228, failed: 33717, success_rate_percent: 99.29 }],
    });

    const { GET } = await import("@/app/api/stats/tx-success-rate/route");
    const req = new NextRequest("http://localhost/api/stats/tx-success-rate");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success_rate_percent).toBe(99.29);
    expect(body.total).toBe(4779945);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "network" });

    const { GET } = await import("@/app/api/stats/tx-success-rate/route");
    const req = new NextRequest("http://localhost/api/stats/tx-success-rate");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns null when yaci returns empty array", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/tx-success-rate/route");
    const req = new NextRequest("http://localhost/api/stats/tx-success-rate");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });
});
