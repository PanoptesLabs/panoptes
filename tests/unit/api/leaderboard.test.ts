import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {},
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

vi.mock("@/lib/intelligence/leaderboard", () => ({
  VALID_CATEGORIES: ["overall", "uptime", "commission", "governance", "rising", "stake_magnet"],
  getLeaderboard: vi.fn(),
  compareValidators: vi.fn(),
  getScoreTrend: vi.fn(),
}));

import { getLeaderboard, compareValidators, getScoreTrend } from "@/lib/intelligence/leaderboard";

const mockGetLeaderboard = vi.mocked(getLeaderboard);
const mockCompareValidators = vi.mocked(compareValidators);
const mockGetScoreTrend = vi.mocked(getScoreTrend);

describe("GET /api/validators/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with leaderboard entries", async () => {
    const entries = [
      { rank: 1, validatorId: "v1", moniker: "Alpha", value: 95, score: 95 },
      { rank: 2, validatorId: "v2", moniker: "Beta", value: 80, score: 80 },
    ];
    mockGetLeaderboard.mockResolvedValue(entries);

    const { GET } = await import("@/app/api/validators/leaderboard/route");
    const req = new NextRequest("http://localhost/api/validators/leaderboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(2);
    expect(body.category).toBe("overall");
    expect(mockGetLeaderboard).toHaveBeenCalledWith("overall", 20);
  });

  it("returns 400 with invalid category", async () => {
    const { GET } = await import("@/app/api/validators/leaderboard/route");
    const req = new NextRequest("http://localhost/api/validators/leaderboard?category=invalid");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid category");
  });

  it("respects limit parameter", async () => {
    mockGetLeaderboard.mockResolvedValue([]);

    const { GET } = await import("@/app/api/validators/leaderboard/route");
    const req = new NextRequest("http://localhost/api/validators/leaderboard?limit=50");
    await GET(req);

    expect(mockGetLeaderboard).toHaveBeenCalledWith("overall", 50);
  });

  it("enforces max limit of 100", async () => {
    mockGetLeaderboard.mockResolvedValue([]);

    const { GET } = await import("@/app/api/validators/leaderboard/route");
    const req = new NextRequest("http://localhost/api/validators/leaderboard?limit=500");
    await GET(req);

    expect(mockGetLeaderboard).toHaveBeenCalledWith("overall", 100);
  });
});

describe("GET /api/validators/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with comparison results", async () => {
    const results = [
      {
        validatorId: "v1",
        moniker: "Alpha",
        metrics: { uptime: 0.98, commission: 0.05, governance: 0.7, stakeStability: 0.9, score: 85 },
      },
    ];
    mockCompareValidators.mockResolvedValue(results);

    const { GET } = await import("@/app/api/validators/compare/route");
    const req = new NextRequest("http://localhost/api/validators/compare?ids=v1,v2");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(mockCompareValidators).toHaveBeenCalledWith(["v1", "v2"]);
  });

  it("returns 400 with too many IDs", async () => {
    const { GET } = await import("@/app/api/validators/compare/route");
    const req = new NextRequest("http://localhost/api/validators/compare?ids=v1,v2,v3,v4,v5,v6");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Maximum 5");
  });

  it("returns 400 with no IDs", async () => {
    const { GET } = await import("@/app/api/validators/compare/route");
    const req = new NextRequest("http://localhost/api/validators/compare");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("ids parameter is required");
  });

  it("returns 400 with empty ids parameter", async () => {
    const { GET } = await import("@/app/api/validators/compare/route");
    const req = new NextRequest("http://localhost/api/validators/compare?ids=");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("ids parameter is required");
  });
});

describe("GET /api/validators/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with trend data", async () => {
    const trend = [
      { timestamp: "2026-03-01T00:00:00.000Z", score: 80 },
      { timestamp: "2026-03-15T00:00:00.000Z", score: 90 },
    ];
    mockGetScoreTrend.mockResolvedValue(trend);

    const { GET } = await import("@/app/api/validators/trends/route");
    const req = new NextRequest("http://localhost/api/validators/trends?id=v1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trend).toHaveLength(2);
    expect(body.validatorId).toBe("v1");
    expect(body.period).toBe("30d");
  });

  it("returns 400 without id parameter", async () => {
    const { GET } = await import("@/app/api/validators/trends/route");
    const req = new NextRequest("http://localhost/api/validators/trends");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("id parameter is required");
  });

  it("returns 400 with invalid period", async () => {
    const { GET } = await import("@/app/api/validators/trends/route");
    const req = new NextRequest("http://localhost/api/validators/trends?id=v1&period=1y");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid period");
  });

  it("accepts valid period parameter", async () => {
    mockGetScoreTrend.mockResolvedValue([]);

    const { GET } = await import("@/app/api/validators/trends/route");
    const req = new NextRequest("http://localhost/api/validators/trends?id=v1&period=7d");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetScoreTrend).toHaveBeenCalledWith("v1", "7d");
  });
});
