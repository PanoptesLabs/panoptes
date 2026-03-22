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
  useDelegationEvents,
  useDelegationFlow,
  useWhaleMovements,
} from "@/hooks/use-delegations";

describe("useDelegationEvents", () => {
  it("calls SWR with /api/delegations when no params", () => {
    useDelegationEvents();
    expect(useSWR).toHaveBeenCalledWith("/api/delegations", expect.any(Object));
  });

  it("builds query string from filter params", () => {
    useDelegationEvents({ type: "delegate", limit: 10, offset: 5 });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("type=delegate");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("includes validatorId param", () => {
    useDelegationEvents({ validatorId: "raivaloper1abc" });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("validatorId=raivaloper1abc");
  });
});

describe("useDelegationFlow", () => {
  it("calls SWR with /api/delegations/flow?days=7", () => {
    useDelegationFlow(7);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/delegations/flow?days=7");
  });

  it("calls SWR without days param when not provided", () => {
    useDelegationFlow();

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/delegations/flow");
  });
});

describe("useWhaleMovements", () => {
  it("calls SWR with /api/delegations/whales", () => {
    useWhaleMovements();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/delegations/whales",
      expect.any(Object),
    );
  });
});
