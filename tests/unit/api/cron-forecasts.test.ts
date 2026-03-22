import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/intelligence", () => ({
  generateForecasts: vi.fn(),
}));

vi.mock("@/lib/cron-helpers", () => ({
  runSingleCron: vi.fn(),
}));

import { runSingleCron } from "@/lib/cron-helpers";
import { generateForecasts } from "@/lib/intelligence";

describe("POST /api/cron/forecasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs forecast generation with auth", async () => {
    vi.mocked(runSingleCron).mockResolvedValue(
      NextResponse.json({ success: true, forecastsGenerated: 10 }),
    );

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(runSingleCron).toHaveBeenCalledWith(
      req,
      "Forecasts",
      generateForecasts,
    );
  });

  it("returns 401 without valid auth", async () => {
    vi.mocked(runSingleCron).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET not configured", async () => {
    vi.mocked(runSingleCron).mockResolvedValue(
      NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 }),
    );

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("handles forecast generation errors", async () => {
    vi.mocked(runSingleCron).mockResolvedValue(
      NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      ),
    );

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
