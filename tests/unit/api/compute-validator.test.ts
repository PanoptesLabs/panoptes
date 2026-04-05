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

vi.mock("@/lib/yaci", async () => {
  const actual = await vi.importActual<typeof import("@/lib/yaci")>("@/lib/yaci");
  return {
    ...actual,
    fetchYaci: vi.fn(),
  };
});

import { fetchYaci } from "@/lib/yaci";

const VALIDATOR_ID = "raivaloper1abc123";

const LEADERBOARD = [
  { target_validator: VALIDATOR_ID, moniker: "test-val", total_jobs: 500, completed_jobs: 400, success_rate: 80.0 },
  { target_validator: "raivaloper1other", moniker: "other", total_jobs: 100, completed_jobs: 90, success_rate: 90.0 },
];

const RECENT_JOBS = [
  {
    job_id: 1, status: "COMPLETED", creator: "rai1x", target_validator: VALIDATOR_ID,
    execution_image: "republicai/gpt2-inference:latest", verification_image: null,
    fee_amount: "1000000", fee_denom: "arai", result_hash: "abc",
    result_fetch_endpoint: null, result_upload_endpoint: null,
    submit_tx_hash: "tx1", submit_height: 100, submit_time: "2026-04-01T00:00:00Z",
    result_tx_hash: "tx2", result_height: 101, result_time: "2026-04-01T00:01:00Z",
    created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:01:00Z",
  },
];

const MODEL_JOBS = [
  { execution_image: "republicai/gpt2-inference:latest" },
  { execution_image: "republicai/gpt2-inference:latest" },
  { execution_image: "republicai/mistral-inference:latest" },
];

async function callRoute(id: string) {
  const { GET } = await import("@/app/api/compute/validator/[id]/route");
  const req = new NextRequest(`http://localhost/api/compute/validator/${id}`);
  return GET(req, { params: Promise.resolve({ id }) });
}

describe("GET /api/compute/validator/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns leaderboard-sourced stats for a known validator", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: true, data: LEADERBOARD })
      .mockResolvedValueOnce({ ok: true, data: RECENT_JOBS })
      .mockResolvedValueOnce({ ok: true, data: MODEL_JOBS });

    const res = await callRoute(VALIDATOR_ID);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toEqual({
      total_jobs: 500,
      completed_jobs: 400,
      success_rate: 80.0,
    });
    expect(body.recentJobs).toHaveLength(1);
    expect(body.models.length).toBeGreaterThan(0);
  });

  it("does not expose sample-derived failed/pending fields", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: true, data: LEADERBOARD })
      .mockResolvedValueOnce({ ok: true, data: RECENT_JOBS })
      .mockResolvedValueOnce({ ok: true, data: MODEL_JOBS });

    const res = await callRoute(VALIDATOR_ID);
    const body = await res.json();

    // These fields must NOT exist — upstream API doesn't provide reliable aggregates
    expect(body.stats).not.toHaveProperty("failed_jobs");
    expect(body.stats).not.toHaveProperty("pending_jobs");
  });

  it("returns models even when model fetch partially fails", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: true, data: LEADERBOARD })
      .mockResolvedValueOnce({ ok: true, data: RECENT_JOBS })
      .mockResolvedValueOnce({ ok: false, error: "timeout" });

    const res = await callRoute(VALIDATOR_ID);
    const body = await res.json();

    expect(body.stats).not.toBeNull();
    expect(body.models).toEqual([]);
  });

  it("returns null stats for unknown validator", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: true, data: LEADERBOARD })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const res = await callRoute("raivaloper1unknown");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats).toBeNull();
    expect(body.models).toEqual([]);
    expect(body.recentJobs).toEqual([]);
  });

  it("returns 502 when all upstream calls fail", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: false, error: "timeout" })
      .mockResolvedValueOnce({ ok: false, error: "network" })
      .mockResolvedValueOnce({ ok: false, error: "http" });

    const res = await callRoute(VALIDATOR_ID);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("extracts unique model display names", async () => {
    vi.mocked(fetchYaci)
      .mockResolvedValueOnce({ ok: true, data: LEADERBOARD })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: MODEL_JOBS });

    const res = await callRoute(VALIDATOR_ID);
    const body = await res.json();

    expect(body.models).toContain("GPT-2");
    expect(body.models).toContain("Mistral");
    expect(body.models).toHaveLength(2);
  });
});
