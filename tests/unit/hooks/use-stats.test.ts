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
import { useNetworkStats, useHealth } from "@/hooks/use-stats";

describe("useNetworkStats", () => {
  it("calls SWR with /api/stats", () => {
    useNetworkStats();
    expect(useSWR).toHaveBeenCalledWith("/api/stats", expect.any(Object));
  });

  it("uses polling config", () => {
    useNetworkStats();
    expect(useSWR).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ refreshInterval: 30000 }),
    );
  });
});

describe("useHealth", () => {
  it("calls SWR with /api/health", () => {
    useHealth();
    expect(useSWR).toHaveBeenCalledWith("/api/health", expect.any(Object));
  });
});
