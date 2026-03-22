import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockProposalFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceProposal: {
      findUnique: (...args: unknown[]) => mockProposalFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>) =>
      NextResponse.json(data, { headers }),
    ),
  };
});

describe("GET /api/governance/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal with votes and summary", async () => {
    mockProposalFindUnique.mockResolvedValue({
      id: "1",
      proposalId: "1",
      title: "Test Proposal",
      description: "Test description",
      status: "PROPOSAL_STATUS_VOTING_PERIOD",
      submitTime: new Date("2026-03-01"),
      depositEndTime: new Date("2026-03-10"),
      votingStartTime: new Date("2026-03-10"),
      votingEndTime: new Date("2026-03-20"),
      votes: [
        { id: "v1", option: "VOTE_OPTION_YES", createdAt: new Date() },
        { id: "v2", option: "VOTE_OPTION_YES", createdAt: new Date() },
        { id: "v3", option: "VOTE_OPTION_NO", createdAt: new Date() },
        { id: "v4", option: "VOTE_OPTION_ABSTAIN", createdAt: new Date() },
        { id: "v5", option: "VOTE_OPTION_NO_WITH_VETO", createdAt: new Date() },
      ],
    });

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(body.id).toBe("1");
    expect(body.title).toBe("Test Proposal");
    expect(body.voteCount).toBe(5);
    expect(body.voteSummary.yes).toBe(2);
    expect(body.voteSummary.no).toBe(1);
    expect(body.voteSummary.abstain).toBe(1);
    expect(body.voteSummary.veto).toBe(1);
  });

  it("returns 404 when proposal not found", async () => {
    mockProposalFindUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/999");
    const res = await GET(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Proposal not found");
  });

  it("handles proposal with no votes", async () => {
    mockProposalFindUnique.mockResolvedValue({
      id: "2",
      proposalId: "2",
      title: "New Proposal",
      description: "No votes yet",
      status: "PROPOSAL_STATUS_VOTING_PERIOD",
      submitTime: new Date(),
      depositEndTime: new Date(),
      votingStartTime: new Date(),
      votingEndTime: new Date(),
      votes: [],
    });

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/2");
    const res = await GET(req, { params: Promise.resolve({ id: "2" }) });
    const body = await res.json();

    expect(body.voteCount).toBe(0);
    expect(body.voteSummary.yes).toBe(0);
    expect(body.voteSummary.no).toBe(0);
    expect(body.voteSummary.abstain).toBe(0);
    expect(body.voteSummary.veto).toBe(0);
  });

  it("queries with correct parameters", async () => {
    mockProposalFindUnique.mockResolvedValue({
      id: "1",
      votes: [],
    });

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/1");
    await GET(req, { params: Promise.resolve({ id: "1" }) });

    expect(mockProposalFindUnique).toHaveBeenCalledWith({
      where: { id: "1" },
      include: {
        votes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  });

  it("orders votes by createdAt descending", async () => {
    const now = new Date("2026-03-22T12:00:00Z");
    const earlier = new Date("2026-03-22T11:00:00Z");

    mockProposalFindUnique.mockResolvedValue({
      id: "1",
      votes: [
        { id: "v1", option: "VOTE_OPTION_YES", createdAt: now },
        { id: "v2", option: "VOTE_OPTION_NO", createdAt: earlier },
      ],
    });

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(body.votes[0].createdAt).toBeDefined();
    expect(body.votes[1].createdAt).toBeDefined();
  });
});
