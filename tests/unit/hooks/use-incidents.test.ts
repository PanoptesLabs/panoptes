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
  sessionSwrConfig: { fetcher: vi.fn() },
  sessionMutate: vi.fn(),
}));

import useSWR from "swr";
import {
  useIncidents,
  useIncidentSummary,
  useIncidentDetail,
} from "@/hooks/use-incidents";

describe("useIncidents", () => {
  it("calls SWR with /api/incidents when no filters", () => {
    useIncidents();
    expect(useSWR).toHaveBeenCalledWith("/api/incidents", expect.any(Object));
  });

  it("builds query string from filter params", () => {
    useIncidents({ status: "open", severity: "critical" });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("status=open");
    expect(url).toContain("severity=critical");
  });

  it("includes entityType, limit, and offset params", () => {
    useIncidents({ entityType: "validator", limit: 5, offset: 10 });

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toContain("entityType=validator");
    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
  });
});

describe("useIncidentSummary", () => {
  it("calls SWR with /api/incidents/summary", () => {
    useIncidentSummary();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/incidents/summary",
      expect.any(Object),
    );
  });
});

describe("useIncidentDetail", () => {
  it("calls SWR with /api/incidents/inc-1", () => {
    useIncidentDetail("inc-1");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/incidents/inc-1");
  });

  it("passes null key when id is null", () => {
    useIncidentDetail(null);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});
