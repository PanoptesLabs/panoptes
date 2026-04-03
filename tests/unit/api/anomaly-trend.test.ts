import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
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

describe("GET /api/anomalies/trend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trend data with filled gaps (all 30 days present)", async () => {
    const mockRows = [
      { day: new Date("2025-01-15T00:00:00Z"), severity: "critical", count: 5n },
      { day: new Date("2025-01-15T00:00:00Z"), severity: "high", count: 3n },
      { day: new Date("2025-01-20T00:00:00Z"), severity: "medium", count: 2n },
    ];

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

    const { GET } = await import("@/app/api/anomalies/trend/route");
    const req = new NextRequest("http://localhost/api/anomalies/trend");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trend).toHaveLength(30);
    expect(body.days).toBe(30);
    expect(body.trend.every((entry: { date: string; critical: number; high: number; medium: number; low: number }) =>
      typeof entry.date === "string" &&
      typeof entry.critical === "number" &&
      typeof entry.high === "number" &&
      typeof entry.medium === "number" &&
      typeof entry.low === "number"
    )).toBe(true);
  });

  it("respects days parameter", async () => {
    const mockRows = [
      { day: new Date("2025-01-10T00:00:00Z"), severity: "high", count: 2n },
    ];

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

    const { GET } = await import("@/app/api/anomalies/trend/route");
    const req = new NextRequest("http://localhost/api/anomalies/trend?days=7");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trend).toHaveLength(7);
    expect(body.days).toBe(7);
  });

  it("clamps days to max 90", async () => {
    const mockRows: Array<{ day: Date; severity: string; count: bigint }> = [];

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

    const { GET } = await import("@/app/api/anomalies/trend/route");
    const req = new NextRequest("http://localhost/api/anomalies/trend?days=200");
    const res = await GET(req);
    const body = await res.json();

    expect(body.days).toBe(90);
    expect(body.trend).toHaveLength(90);
  });

  it("returns zero-filled entries for days without anomalies", async () => {
    const mockRows: Array<{ day: Date; severity: string; count: bigint }> = [];

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

    const { GET } = await import("@/app/api/anomalies/trend/route");
    const req = new NextRequest("http://localhost/api/anomalies/trend?days=5");
    const res = await GET(req);
    const body = await res.json();

    expect(body.trend).toHaveLength(5);
    expect(body.trend.every((entry: { critical: number; high: number; medium: number; low: number }) =>
      entry.critical === 0 &&
      entry.high === 0 &&
      entry.medium === 0 &&
      entry.low === 0
    )).toBe(true);
  });

  it("correctly pivots severity counts", async () => {
    const now = new Date();
    const mockDate = new Date(now);
    mockDate.setHours(0, 0, 0, 0);

    const mockRows = [
      { day: mockDate, severity: "critical", count: 10n },
      { day: mockDate, severity: "high", count: 5n },
      { day: mockDate, severity: "medium", count: 3n },
      { day: mockDate, severity: "low", count: 1n },
    ];

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

    const { GET } = await import("@/app/api/anomalies/trend/route");
    const req = new NextRequest("http://localhost/api/anomalies/trend?days=30");
    const res = await GET(req);
    const body = await res.json();

    const targetDate = mockDate.toISOString().split("T")[0];
    const entry = body.trend.find((e: { date: string }) => e.date === targetDate);

    expect(entry).toBeDefined();
    expect(entry.critical).toBe(10);
    expect(entry.high).toBe(5);
    expect(entry.medium).toBe(3);
    expect(entry.low).toBe(1);
  });
});
