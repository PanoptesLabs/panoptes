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

describe("GET /api/validators/[id]/rewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reward history and uses correct URL with validator_address filter", async () => {
    const mockData = [
      { id: 1, height: 235764, validator_address: "raivaloper1abc", rewards: "1357261091346037.479", commission: "135726109134603.748", created_at: "2026-02-10T16:14:37Z" },
    ];
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: mockData });

    const { GET } = await import("@/app/api/validators/[id]/rewards/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/rewards");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].height).toBe(235764);

    // Assert the correct URL was called with validator_address filter
    expect(vi.mocked(fetchYaci)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchYaci).mock.calls[0][0]).toBe(
      "/validator_rewards?validator_address=eq.raivaloper1abc&order=height.desc&limit=100",
    );
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "http" });

    const { GET } = await import("@/app/api/validators/[id]/rewards/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/rewards");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns empty array when no rewards", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: true, data: [] });

    const { GET } = await import("@/app/api/validators/[id]/rewards/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/rewards");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });
});
