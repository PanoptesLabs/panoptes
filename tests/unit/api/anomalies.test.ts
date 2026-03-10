import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    anomaly: {
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

import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const now = new Date();

const mockAnomaly = {
  id: "a1",
  type: "jailing",
  severity: "high",
  entityType: "validator",
  entityId: "val1",
  title: "Validator TestVal jailed",
  description: "Validator TestVal has been jailed.",
  metadata: JSON.stringify({ moniker: "TestVal" }),
  resolved: false,
  detectedAt: now,
  resolvedAt: null,
};

describe("GET /api/anomalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all anomalies with no filters", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([mockAnomaly]);
    mockPrisma.anomaly.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies");
    const res = await GET(req);
    const body = await res.json();

    expect(body.anomalies).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.anomalies[0].type).toBe("jailing");
  });

  it("filters by type", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies?type=endpoint_down");
    await GET(req);

    expect(mockPrisma.anomaly.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "endpoint_down" }),
      }),
    );
  });

  it("filters by severity", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies?severity=critical");
    await GET(req);

    expect(mockPrisma.anomaly.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "critical" }),
      }),
    );
  });

  it("filters by resolved status", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies?resolved=false");
    await GET(req);

    expect(mockPrisma.anomaly.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resolved: false }),
      }),
    );
  });

  it("supports pagination", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(100);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies?limit=10&offset=20");
    await GET(req);

    expect(mockPrisma.anomaly.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      }),
    );
  });

  it("parses metadata JSON correctly", async () => {
    mockPrisma.anomaly.findMany.mockResolvedValue([mockAnomaly]);
    mockPrisma.anomaly.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/anomalies/route");
    const req = new NextRequest("http://localhost/api/anomalies");
    const res = await GET(req);
    const body = await res.json();

    expect(body.anomalies[0].metadata).toEqual({ moniker: "TestVal" });
  });
});
