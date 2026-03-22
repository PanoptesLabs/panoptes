import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>) =>
      NextResponse.json(data, { headers }),
    ),
  };
});

vi.mock("@/lib/intelligence/governance-scoring", () => ({
  computeGovernanceScores: vi.fn(),
}));

import { computeGovernanceScores } from "@/lib/intelligence/governance-scoring";

describe("GET /api/governance/participation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sorted validators by participation rate", async () => {
    vi.mocked(computeGovernanceScores).mockResolvedValue([
      { validatorId: "val-a", proposalsVoted: 19, totalProposals: 20, participationRate: 0.95 },
      { validatorId: "val-b", proposalsVoted: 17, totalProposals: 20, participationRate: 0.85 },
      { validatorId: "val-c", proposalsVoted: 20, totalProposals: 20, participationRate: 1.0 },
    ]);

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");
    const res = await GET(req);
    const body = await res.json();

    expect(body.validators).toHaveLength(3);
    expect(body.totalValidators).toBe(3);
    // Sorted descending by participationRate
    expect(body.validators[0].participationRate).toBe(1.0);
    expect(body.validators[1].participationRate).toBe(0.95);
    expect(body.validators[2].participationRate).toBe(0.85);
  });

  it("handles empty validator list", async () => {
    vi.mocked(computeGovernanceScores).mockResolvedValue([]);

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");
    const res = await GET(req);
    const body = await res.json();

    expect(body.validators).toHaveLength(0);
    expect(body.totalValidators).toBe(0);
  });

  it("includes all governance score fields", async () => {
    vi.mocked(computeGovernanceScores).mockResolvedValue([
      { validatorId: "val-1", proposalsVoted: 9, totalProposals: 10, participationRate: 0.9 },
    ]);

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");
    const res = await GET(req);
    const body = await res.json();

    expect(body.validators[0]).toHaveProperty("validatorId");
    expect(body.validators[0]).toHaveProperty("proposalsVoted");
    expect(body.validators[0]).toHaveProperty("totalProposals");
    expect(body.validators[0]).toHaveProperty("participationRate");
  });

  it("handles database errors gracefully", async () => {
    vi.mocked(computeGovernanceScores).mockRejectedValue(new Error("Database error"));

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");

    await expect(GET(req)).rejects.toThrow("Database error");
  });

  it("handles validators with same participation rate", async () => {
    vi.mocked(computeGovernanceScores).mockResolvedValue([
      { validatorId: "val-a", proposalsVoted: 17, totalProposals: 20, participationRate: 0.85 },
      { validatorId: "val-b", proposalsVoted: 17, totalProposals: 20, participationRate: 0.85 },
    ]);

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");
    const res = await GET(req);
    const body = await res.json();

    expect(body.validators).toHaveLength(2);
    expect(body.validators[0].participationRate).toBe(0.85);
    expect(body.validators[1].participationRate).toBe(0.85);
  });
});
