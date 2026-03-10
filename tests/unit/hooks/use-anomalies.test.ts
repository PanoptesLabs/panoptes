import { describe, it, expect, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn((url: string) => ({
    data: null,
    error: null,
    isLoading: true,
    mutate: vi.fn(),
    _url: url,
  })),
}));

vi.mock("@/hooks/use-api", () => ({
  pollingSwrConfig: { refreshInterval: 30000 },
}));

import useSWR from "swr";
import { useAnomalies } from "@/hooks/use-anomalies";

describe("useAnomalies", () => {
  it("calls SWR with default URL when no filters", () => {
    useAnomalies();
    expect(useSWR).toHaveBeenCalledWith("/api/anomalies", expect.any(Object));
  });

  it("includes filters in query string", () => {
    useAnomalies({ type: "jailing", severity: "high" });
    expect(useSWR).toHaveBeenCalledWith(
      expect.stringContaining("type=jailing"),
      expect.any(Object),
    );
    expect(useSWR).toHaveBeenCalledWith(
      expect.stringContaining("severity=high"),
      expect.any(Object),
    );
  });

  it("includes resolved filter", () => {
    useAnomalies({ resolved: false });
    expect(useSWR).toHaveBeenCalledWith(
      expect.stringContaining("resolved=false"),
      expect.any(Object),
    );
  });

  it("passes polling config", () => {
    useAnomalies();
    expect(useSWR).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ refreshInterval: 30000 }),
    );
  });
});
