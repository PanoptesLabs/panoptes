import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    forecast: {
      count: vi.fn(),
      groupBy: vi.fn(),
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

import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("GET /api/forecasts/accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("excludes unverifiable forecasts from accuracy denominator", async () => {
    // 10 verified total: 7 verifiable (wasAccurate != null), 3 unverifiable (wasAccurate = null)
    // Of the 7 verifiable: 5 accurate
    // Expected accuracy: 5/7 = 71.43%, NOT 5/10 = 50%
    mockPrisma.forecast.count
      .mockResolvedValueOnce(10)  // totalVerified (verifiedAt != null)
      .mockResolvedValueOnce(7)   // totalVerifiable (wasAccurate != null)
      .mockResolvedValueOnce(5);  // totalAccurate (wasAccurate = true)

    mockPrisma.forecast.groupBy
      .mockResolvedValueOnce([    // byMetricRaw (verifiable only)
        { metric: "latency", _count: { id: 4 } },
        { metric: "jail_risk", _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([    // accurateByMetric
        { metric: "latency", _count: { id: 3 } },
        { metric: "jail_risk", _count: { id: 2 } },
      ]);

    const { GET } = await import("@/app/api/forecasts/accuracy/route");
    const req = new NextRequest("http://localhost/api/forecasts/accuracy");
    const res = await GET(req);
    const body = await res.json();

    expect(body.totalVerified).toBe(10);
    expect(body.totalVerifiable).toBe(7);
    expect(body.unverifiable).toBe(3);
    expect(body.totalAccurate).toBe(5);
    expect(body.overallAccuracy).toBeCloseTo(71.43, 1);
    expect(body.byMetric).toHaveLength(2);
    expect(body.byMetric[0].accuracyRate).toBeCloseTo(75.0, 1); // 3/4
    expect(body.byMetric[1].accuracyRate).toBeCloseTo(66.67, 1); // 2/3
  });

  it("returns null accuracy when no verifiable forecasts exist", async () => {
    // 3 verified but all unverifiable (entity not found etc)
    mockPrisma.forecast.count
      .mockResolvedValueOnce(3)   // totalVerified
      .mockResolvedValueOnce(0)   // totalVerifiable
      .mockResolvedValueOnce(0);  // totalAccurate

    mockPrisma.forecast.groupBy
      .mockResolvedValueOnce([])  // byMetricRaw
      .mockResolvedValueOnce([]); // accurateByMetric

    const { GET } = await import("@/app/api/forecasts/accuracy/route");
    const req = new NextRequest("http://localhost/api/forecasts/accuracy");
    const res = await GET(req);
    const body = await res.json();

    expect(body.totalVerified).toBe(3);
    expect(body.totalVerifiable).toBe(0);
    expect(body.unverifiable).toBe(3);
    expect(body.overallAccuracy).toBeNull();
    expect(body.byMetric).toHaveLength(0);
  });

  it("respects metric filter parameter", async () => {
    mockPrisma.forecast.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4);

    mockPrisma.forecast.groupBy
      .mockResolvedValueOnce([{ metric: "latency", _count: { id: 5 } }])
      .mockResolvedValueOnce([{ metric: "latency", _count: { id: 4 } }]);

    const { GET } = await import("@/app/api/forecasts/accuracy/route");
    const req = new NextRequest("http://localhost/api/forecasts/accuracy?metric=latency");
    const res = await GET(req);
    const body = await res.json();

    expect(body.overallAccuracy).toBe(80);
    expect(body.byMetric[0].metric).toBe("latency");

    // Verify the metric filter was passed to the query
    const countCalls = mockPrisma.forecast.count.mock.calls;
    expect(countCalls[0][0].where.metric).toBe("latency");
  });

  it("clamps days parameter to 1-365 range", async () => {
    mockPrisma.forecast.count.mockResolvedValue(0);
    mockPrisma.forecast.groupBy.mockResolvedValue([]);

    const { GET } = await import("@/app/api/forecasts/accuracy/route");
    const req = new NextRequest("http://localhost/api/forecasts/accuracy?days=500");
    const res = await GET(req);
    const body = await res.json();

    expect(body.days).toBe(365);
  });
});
