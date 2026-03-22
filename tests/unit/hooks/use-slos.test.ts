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
  useSloSummary,
  useSloDetail,
  useSloEvaluations,
} from "@/hooks/use-slos";

describe("useSloSummary", () => {
  it("calls SWR with /api/slos/summary", () => {
    useSloSummary();
    expect(useSWR).toHaveBeenCalledWith(
      "/api/slos/summary",
      expect.any(Object),
    );
  });
});

describe("useSloDetail", () => {
  it("calls SWR with /api/slos/slo-1", () => {
    useSloDetail("slo-1");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/slos/slo-1");
  });

  it("passes null key when id is null", () => {
    useSloDetail(null);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});

describe("useSloEvaluations", () => {
  it("calls SWR with /api/slos/slo-1/evaluations", () => {
    useSloEvaluations("slo-1");

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    const url = call?.[0] as string;

    expect(url).toBe("/api/slos/slo-1/evaluations");
  });

  it("passes null key when id is null", () => {
    useSloEvaluations(null);

    const call = vi.mocked(useSWR).mock.calls.at(-1);
    expect(call?.[0]).toBeNull();
  });
});
