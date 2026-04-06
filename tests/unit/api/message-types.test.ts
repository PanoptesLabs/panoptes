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

describe("GET /api/stats/message-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns message type stats", async () => {
    const mockData = [
      { message_type: "/cosmos.staking.v1beta1.MsgDelegate", count: 1000, percentage: 50 },
      { message_type: "/cosmos.bank.v1beta1.MsgSend", count: 500, percentage: 25 },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/stats/message-types/route");
    const req = new NextRequest("http://localhost/api/stats/message-types");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].count).toBe(1000);
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "http" });

    const { GET } = await import("@/app/api/stats/message-types/route");
    const req = new NextRequest("http://localhost/api/stats/message-types");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when yaci returns no data", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/stats/message-types/route");
    const req = new NextRequest("http://localhost/api/stats/message-types");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
