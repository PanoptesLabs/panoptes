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
import {
  useLeaderboard,
  useValidatorCompare,
  useScoreTrend,
} from "@/hooks/use-leaderboard";

describe("useLeaderboard", () => {
  it("calls SWR with /api/validators/leaderboard when no params", () => {
    useLeaderboard();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/validators/leaderboard",
      expect.any(Object),
    );
  });

  it("builds query string with category and limit", () => {
    useLeaderboard("uptime", 5);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("category=uptime");
    expect(url).toContain("limit=5");
  });
});

describe("useValidatorCompare", () => {
  it("calls SWR with comma-separated ids", () => {
    useValidatorCompare(["v1", "v2"]);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/validators/compare?ids=v1,v2");
  });

  it("passes null key when ids array is empty", () => {
    useValidatorCompare([]);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});

describe("useScoreTrend", () => {
  it("calls SWR with id and period params", () => {
    useScoreTrend("v1", "30d");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("id=v1");
    expect(url).toContain("period=30d");
  });

  it("passes null key when id is null", () => {
    useScoreTrend(null);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });

  it("omits period when not provided", () => {
    useScoreTrend("v1");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("id=v1");
    expect(url).not.toContain("period");
  });
});
