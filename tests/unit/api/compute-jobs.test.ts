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

const COUNT_RESPONSE = {
  data: [],
  pagination: { total: 2620000, limit: 0, offset: 0, has_next: true, has_prev: false },
};

const MONIKER_RESPONSE = [
  { target_validator: "raivaloper1abc", moniker: "TestValidator" },
];

/** Mock fetchYaci to return different responses based on the path */
function mockFetchYaci(overrides?: { jobs?: unknown; count?: unknown; monikers?: unknown }) {
  vi.mocked(fetchYaci).mockImplementation((path: string) => {
    if (path.startsWith("/compute_jobs")) {
      return Promise.resolve({ ok: true, data: overrides?.jobs ?? [SAMPLE_JOB] });
    }
    if (path.startsWith("/rpc/get_compute_jobs")) {
      return Promise.resolve({ ok: true, data: overrides?.count ?? COUNT_RESPONSE });
    }
    if (path.startsWith("/compute_leaderboard")) {
      return Promise.resolve({ ok: true, data: overrides?.monikers ?? MONIKER_RESPONSE });
    }
    return Promise.resolve({ ok: false, error: "network" });
  });
}

describe("GET /api/compute/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns jobs with moniker map and total", async () => {
    mockFetchYaci();

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].job_id).toBe(970475);
    expect(body.hasNext).toBe(false);
    expect(body.total).toBe(2620000);
    expect(body.monikers).toEqual({ raivaloper1abc: "TestValidator" });
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("sets hasNext when more results exist (limit+1 trick)", async () => {
    const jobs = Array.from({ length: 21 }, (_, i) => ({ ...SAMPLE_JOB, job_id: i }));
    mockFetchYaci({ jobs });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(body.hasNext).toBe(true);
    expect(body.jobs).toHaveLength(20);
  });

  it("passes status filter to table endpoint and RPC count", async () => {
    mockFetchYaci({ jobs: [] });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs?status=COMPLETED&limit=5");
    await GET(req);

    const calls = vi.mocked(fetchYaci).mock.calls.map((c) => c[0]);
    const jobsCall = calls.find((p) => p.startsWith("/compute_jobs"));
    const countCall = calls.find((p) => p.startsWith("/rpc/get_compute_jobs"));

    expect(jobsCall).toContain("status=eq.COMPLETED");
    expect(jobsCall).toContain("limit=6"); // limit+1
    expect(countCall).toContain("_status=COMPLETED");
  });

  it("passes validator filter to both endpoints", async () => {
    mockFetchYaci({ jobs: [] });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs?validator=raivaloper1abc");
    await GET(req);

    const calls = vi.mocked(fetchYaci).mock.calls.map((c) => c[0]);
    const jobsCall = calls.find((p) => p.startsWith("/compute_jobs"));
    const countCall = calls.find((p) => p.startsWith("/rpc/get_compute_jobs"));

    expect(jobsCall).toContain("target_validator=eq.raivaloper1abc");
    expect(countCall).toContain("_validator=raivaloper1abc");
  });

  it("returns total:null when count call fails", async () => {
    vi.mocked(fetchYaci).mockImplementation((path: string) => {
      if (path.startsWith("/compute_jobs")) {
        return Promise.resolve({ ok: true, data: [SAMPLE_JOB] });
      }
      // count and moniker calls fail
      return Promise.resolve({ ok: false, error: "timeout" });
    });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBeNull();
    expect(body.monikers).toEqual({});
  });

  it("returns 502 when jobs call fails", async () => {
    vi.mocked(fetchYaci).mockResolvedValue({ ok: false, error: "timeout" });

    const { GET } = await import("@/app/api/compute/jobs/route");
    const req = new NextRequest("http://localhost/api/compute/jobs");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });
});
