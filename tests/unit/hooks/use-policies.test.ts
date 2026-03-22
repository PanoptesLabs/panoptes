import { describe, it, expect, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn((url: string | null) => ({
    data: null,
    error: null,
    isLoading: true,
    mutate: vi.fn(),
    _url: url,
  })),
}));

vi.mock("@/hooks/use-api", () => ({
  sessionSwrConfig: { fetcher: vi.fn() },
  sessionMutate: vi.fn().mockResolvedValue({}),
}));

import useSWR from "swr";
import { usePolicies, usePolicyDetail, createPolicy, deletePolicy } from "@/hooks/use-policies";
import { sessionMutate } from "@/hooks/use-api";

describe("usePolicies", () => {
  it("calls SWR with /api/policies", () => {
    usePolicies();
    expect(useSWR).toHaveBeenCalledWith("/api/policies", expect.any(Object));
  });
});

describe("usePolicyDetail", () => {
  it("calls SWR with policy ID URL", () => {
    usePolicyDetail("pol-1");
    expect(useSWR).toHaveBeenCalledWith("/api/policies/pol-1", expect.any(Object));
  });

  it("passes null when no id", () => {
    usePolicyDetail(null);
    expect(useSWR).toHaveBeenCalledWith(null, expect.any(Object));
  });
});

describe("createPolicy", () => {
  it("calls sessionMutate with POST", async () => {
    await createPolicy({ name: "Test", conditions: [], actions: [] });
    expect(sessionMutate).toHaveBeenCalledWith("/api/policies", "POST", expect.objectContaining({ name: "Test" }));
  });
});

describe("deletePolicy", () => {
  it("calls sessionMutate with DELETE", async () => {
    await deletePolicy("pol-1");
    expect(sessionMutate).toHaveBeenCalledWith("/api/policies/pol-1", "DELETE");
  });
});
