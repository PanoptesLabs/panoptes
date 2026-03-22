import { describe, it, expect, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn(
    (url: string | null, _config?: Record<string, unknown>) => ({
      data: undefined,
      error: undefined,
      isLoading: true,
      _url: url,
    }),
  ),
}));

vi.mock("@/hooks/use-api", () => ({
  defaultSwrConfig: { fetcher: vi.fn() },
}));

import useSWR from "swr";
import {
  useGovernanceProposals,
  useGovernanceProposal,
  useGovernanceParticipation,
} from "@/hooks/use-governance";

describe("useGovernanceProposals", () => {
  it("calls SWR with /api/governance when no params", () => {
    useGovernanceProposals();
    expect(useSWR).toHaveBeenCalledWith("/api/governance", expect.any(Object));
  });

  it("builds query string from filter params", () => {
    useGovernanceProposals({
      status: "PROPOSAL_STATUS_VOTING_PERIOD",
      limit: 10,
    });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("status=PROPOSAL_STATUS_VOTING_PERIOD");
    expect(url).toContain("limit=10");
  });

  it("includes offset param", () => {
    useGovernanceProposals({ offset: 20 });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("offset=20");
  });
});

describe("useGovernanceProposal", () => {
  it("calls SWR with /api/governance/5", () => {
    useGovernanceProposal("5");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/governance/5");
  });

  it("passes null key when id is null", () => {
    useGovernanceProposal(null);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});

describe("useGovernanceParticipation", () => {
  it("calls SWR with /api/governance/participation", () => {
    useGovernanceParticipation();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/governance/participation",
      expect.any(Object),
    );
  });
});
