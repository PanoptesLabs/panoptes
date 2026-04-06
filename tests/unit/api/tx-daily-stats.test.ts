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

describe("GET /api/stats/tx-daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns daily tx stats array", async () => {
    const mockData = [
      { date: "2026-04-01", total_txs: 216330, successful_txs: 216250, failed_txs: 80, unique_senders: 0 },
      { date: "2026-03-31", total_txs: 200000, successful_txs: 199900, failed_txs: 100, unique_senders: 0 },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/stats/tx-daily/route");
    const req = new NextRequest("http://localhost/api/stats/tx-daily");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].total_txs).toBe(216330);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/stats/tx-daily/route");
    const req = new NextRequest("http://localhost/api/stats/tx-daily");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when yaci returns no data", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/tx-daily/route");
    const req = new NextRequest("http://localhost/api/stats/tx-daily");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
