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
  pollingSwrConfig: { fetcher: vi.fn(), refreshInterval: 30000 },
}));

import useSWR from "swr";
import { useForecasts } from "@/hooks/use-forecasts";

describe("useForecasts", () => {
  it("calls SWR with /api/forecasts when no filters", () => {
    useForecasts();
    expect(useSWR).toHaveBeenCalledWith("/api/forecasts", expect.any(Object));
  });

  it("builds query string from filter params", () => {
    useForecasts({ entityType: "validator", metric: "latency", limit: 10 });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("entityType=validator");
    expect(url).toContain("metric=latency");
    expect(url).toContain("limit=10");
  });

  it("includes entityId and offset params", () => {
    useForecasts({ entityId: "val-1", offset: 5 });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("entityId=val-1");
    expect(url).toContain("offset=5");
  });

  it("uses polling config", () => {
    useForecasts();
    expect(useSWR).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ refreshInterval: 30000 }),
    );
  });
});
