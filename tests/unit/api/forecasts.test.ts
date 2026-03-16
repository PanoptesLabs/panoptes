import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    forecast: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>, status = 200) =>
      NextResponse.json(data, { status, headers }),
    ),
  };
});

vi.mock("@/lib/cron-auth", () => ({
  validateCronAuth: vi.fn(),
}));

vi.mock("@/lib/intelligence", () => ({
  getForecasts: vi.fn(),
  generateForecasts: vi.fn(),
}));

import { getForecasts, generateForecasts } from "@/lib/intelligence";
import { validateCronAuth } from "@/lib/cron-auth";

const now = new Date();

const mockForecast = {
  id: "f1",
  entityType: "endpoint",
  entityId: "ep1",
  metric: "latency",
  prediction: "warning",
  confidence: 85,
  timeHorizon: "1h",
  currentValue: 3000,
  predictedValue: 7000,
  threshold: 5000,
  reasoning: "Latency projected to reach 7000ms",
  validUntil: new Date(Date.now() + 3600000),
  createdAt: now,
};

describe("GET /api/forecasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forecasts", async () => {
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [mockForecast],
      total: 1,
    });

    const { GET } = await import("@/app/api/forecasts/route");
    const req = new NextRequest("http://localhost/api/forecasts");
    const res = await GET(req);
    const body = await res.json();

    expect(body.forecasts).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.forecasts[0].metric).toBe("latency");
  });

  it("passes filters to getForecasts", async () => {
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [],
      total: 0,
    });

    const { GET } = await import("@/app/api/forecasts/route");
    const req = new NextRequest("http://localhost/api/forecasts?metric=latency&entityType=endpoint");
    await GET(req);

    expect(getForecasts).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "latency",
        entityType: "endpoint",
      }),
    );
  });

  it("ignores invalid metric filter", async () => {
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [],
      total: 0,
    });

    const { GET } = await import("@/app/api/forecasts/route");
    const req = new NextRequest("http://localhost/api/forecasts?metric=invalid_metric");
    await GET(req);

    expect(getForecasts).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: undefined,
      }),
    );
  });
});

describe("GET /api/forecasts/[entityType]/[entityId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns entity-specific forecasts", async () => {
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [mockForecast],
      total: 1,
    });

    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/endpoint/ep1");
    const res = await GET(req, {
      params: Promise.resolve({ entityType: "endpoint", entityId: "ep1" }),
    });
    const body = await res.json();

    expect(body.forecasts).toHaveLength(1);
    expect(getForecasts).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "endpoint",
        entityId: "ep1",
      }),
    );
  });
});

describe("POST /api/cron/forecasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCronAuth).mockReturnValue(null);
  });

  it("generates forecasts on success", async () => {
    vi.mocked(generateForecasts).mockResolvedValue({
      generated: 15,
      duration: 500,
    });

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.generated).toBe(15);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(validateCronAuth).mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 500 on error", async () => {
    vi.mocked(generateForecasts).mockRejectedValue(new Error("DB error"));

    const { POST } = await import("@/app/api/cron/forecasts/route");
    const req = new NextRequest("http://localhost/api/cron/forecasts", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
