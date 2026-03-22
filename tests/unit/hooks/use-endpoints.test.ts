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
  pollingSwrConfig: { fetcher: vi.fn(), refreshInterval: 30000 },
}));

import useSWR from "swr";
import { useEndpoints, useBestEndpoint } from "@/hooks/use-endpoints";

describe("useEndpoints", () => {
  it("calls SWR with /api/endpoints", () => {
    useEndpoints();
    expect(useSWR).toHaveBeenCalledWith("/api/endpoints", expect.any(Object));
  });

  it("uses polling config", () => {
    useEndpoints();
    expect(useSWR).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ refreshInterval: 30000 }),
    );
  });
});

describe("useBestEndpoint", () => {
  it("calls SWR with /api/endpoints/best?type=rpc when type provided", () => {
    useBestEndpoint("rpc");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/endpoints/best?type=rpc");
  });

  it("calls SWR with /api/endpoints/best when no type", () => {
    useBestEndpoint();

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/endpoints/best");
  });
});
