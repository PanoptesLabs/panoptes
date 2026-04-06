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

describe("GET /api/validators/[id]/jailing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves consensus address then fetches jailing events", async () => {
    vi.mocked(fetchYaci)
      // First call: validator lookup to get consensus address
      .mockResolvedValueOnce({
        ok: true,
        data: [{ operator_address: "raivaloper1abc", consensus_address: "raivalcons1xyz" }],
      })
      // Second call: jailing events filtered by consensus address
      .mockResolvedValueOnce({
        ok: true,
        data: [
          { id: 1, validator_address: "raivalcons1xyz", operator_address: null, height: 144500, detected_at: "2026-02-04T18:54:47Z", prev_block_flag: "FINALIZE_BLOCK_EVENT", current_block_flag: "liveness" },
        ],
      });

    const { GET } = await import("@/app/api/validators/[id]/jailing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/jailing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].height).toBe(144500);

    // Assert the correct URLs were called
    expect(vi.mocked(fetchYaci)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchYaci).mock.calls[0][0]).toContain("/validators?operator_address=eq.raivaloper1abc");
    expect(vi.mocked(fetchYaci).mock.calls[1][0]).toContain("/jailing_events?validator_address=eq.raivalcons1xyz");
  });

  it("returns 502 when validator lookup fails", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/validators/[id]/jailing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/jailing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns 502 when jailing events fetch fails after successful lookup", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({
        ok: true,
        data: [{ operator_address: "raivaloper1abc", consensus_address: "raivalcons1xyz" }],
      })
      .mockResolvedValueOnce({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/validators/[id]/jailing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/jailing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
    expect(vi.mocked(fetchYaci)).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when validator has no consensus address", async () => {
    vi.mocked(fetchYaci).mockResolvedValueOnce({
      ok: true,
      data: [{ operator_address: "raivaloper1abc", consensus_address: null }],
    });

    const { GET } = await import("@/app/api/validators/[id]/jailing/route");
    const req = new NextRequest("http://localhost/api/validators/raivaloper1abc/jailing");
    const res = await GET(req, { params: Promise.resolve({ id: "raivaloper1abc" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
    // Should only call validator lookup, not jailing events
    expect(vi.mocked(fetchYaci)).toHaveBeenCalledTimes(1);
  });
});
