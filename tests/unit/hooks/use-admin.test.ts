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
  sessionMutate: vi.fn(),
}));

import useSWR from "swr";
import {
  useAdminOverview,
  useAdminAccess,
  useAdminOperations,
  useAdminAudit,
} from "@/hooks/use-admin";

describe("admin hooks", () => {
  it("useAdminOverview calls correct URL", () => {
    useAdminOverview();
    expect(useSWR).toHaveBeenCalledWith("/api/admin/overview", expect.any(Object));
  });

  it("useAdminAccess calls correct URL", () => {
    useAdminAccess();
    expect(useSWR).toHaveBeenCalledWith("/api/admin/access", expect.any(Object));
  });

  it("useAdminOperations calls correct URL", () => {
    useAdminOperations();
    expect(useSWR).toHaveBeenCalledWith("/api/admin/operations", expect.any(Object));
  });

  it("useAdminAudit includes query params", () => {
    useAdminAudit({ limit: 10, offset: 5, action: "create" });
    expect(useSWR).toHaveBeenCalledWith(
      expect.stringContaining("limit=10"),
      expect.any(Object),
    );
    expect(useSWR).toHaveBeenCalledWith(
      expect.stringContaining("offset=5"),
      expect.any(Object),
    );
  });

  it("useAdminAudit works without params", () => {
    useAdminAudit();
    expect(useSWR).toHaveBeenCalledWith("/api/admin/audit", expect.any(Object));
  });
});
