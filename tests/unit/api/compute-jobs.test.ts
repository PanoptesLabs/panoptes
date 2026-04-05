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

const SAMPLE_JOB = {
  job_id: 970475,
  creator: "rai1abc",
  target_validator: "raivaloper1abc",
  execution_image: "republicai/gpt2-inference:latest",
  result_upload_endpoint: "https://example.com/upload",
  result_fetch_endpoint: "https://example.com/result",
  verification_image: "example-verification:latest",
  fee_denom: "arai",
  fee_amount: "1000000",
  status: "PENDING",
  result_hash: null,
  submit_tx_hash: "abc123",
  submit_height: null,
  submit_time: null,
  result_tx_hash: null,
  result_height: null,
  result_time: null,
  created_at: "2026-03-26T13:55:48.235161+00:00",
  updated_at: "2026-03-26T13:55:48.235161+00:00",
};

describe("GET /api/compute/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns jobs from rpc/get_compute_jobs wrapped response", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: {
        data: [SAMPLE_JOB],
        pagination: { total: 2618549, limit: 20, offset: 0, has_next: true, has_prev: false },
      },
    });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].job_id).toBe(970475);
    expect(body.total).toBe(2618549);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("passes status filter to yaci", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: { data: [], pagination: { total: 0, limit: 20, offset: 0, has_next: false, has_prev: false } },
    });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs?status=COMPLETED&limit=5");
    await GET(req);

    const calledPath = vi.mocked(fetchYaci).mock.calls[0][0];
    expect(calledPath).toContain("status=eq.COMPLETED");
    expect(calledPath).toContain("_limit=5");
  });

  it("passes validator filter to yaci", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({
      ok: true,
      data: { data: [], pagination: { total: 0, limit: 20, offset: 0, has_next: false, has_prev: false } },
    });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs?validator=raivaloper1abc");
    await GET(req);

    const calledPath = vi.mocked(fetchYaci).mock.calls[0][0];
    expect(calledPath).toContain("target_validator=eq.raivaloper1abc");
  });

  it("returns 502 when yaci is unreachable", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });
});
