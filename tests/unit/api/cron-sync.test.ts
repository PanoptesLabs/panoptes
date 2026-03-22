import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/cron-auth", () => ({
  validateCronAuth: vi.fn(),
}));

vi.mock("@/lib/indexer", () => ({
  syncGovernance: vi.fn(),
  syncDelegations: vi.fn(),
}));

vi.mock("@/lib/cron-helpers", () => ({
  runStep: vi.fn(),
}));

import { validateCronAuth } from "@/lib/cron-auth";
import { syncGovernance, syncDelegations } from "@/lib/indexer";
import { runStep } from "@/lib/cron-helpers";

describe("POST /api/cron/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs sync successfully", async () => {
    vi.mocked(validateCronAuth).mockReturnValue(null);
    vi.mocked(runStep)
      .mockResolvedValueOnce({ proposalsSynced: 5, votesSynced: 20 })
      .mockResolvedValueOnce({ eventsSynced: 10, snapshotsTaken: 2 });

    const { POST } = await import("@/app/api/cron/sync/route");
    const req = new NextRequest("http://localhost/api/cron/sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.governance.proposalsSynced).toBe(5);
    expect(body.governance.votesSynced).toBe(20);
    expect(body.delegations.eventsSynced).toBe(10);
    expect(body.delegations.snapshotsTaken).toBe(2);
    expect(body.errors).toBeUndefined();
  });

  it("returns 401 without valid auth", async () => {
    vi.mocked(validateCronAuth).mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("@/app/api/cron/sync/route");
    const req = new NextRequest("http://localhost/api/cron/sync", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("handles partial success with errors", async () => {
    vi.mocked(validateCronAuth).mockReturnValue(null);
    vi.mocked(runStep)
      .mockImplementationOnce(async (_name, _fn, _errArr) => {
        return { proposalsSynced: 5, votesSynced: 20 };
      })
      .mockImplementationOnce(async (_name, _fn, _errArr) => {
        _errArr.push({ step: "syncDelegations", error: "Network timeout" });
        return null;
      });

    const { POST } = await import("@/app/api/cron/sync/route");
    const req = new NextRequest("http://localhost/api/cron/sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(207);
    expect(body.partial).toBe(true);
    expect(body.success).toBe(false);
  });

  it("handles complete failure", async () => {
    vi.mocked(validateCronAuth).mockReturnValue(null);

    vi.mocked(runStep)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/cron/sync/route");
    const req = new NextRequest("http://localhost/api/cron/sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.governance.proposalsSynced).toBe(0);
    expect(body.delegations.eventsSynced).toBe(0);
  });

  it("runs both sync operations in parallel", async () => {
    vi.mocked(validateCronAuth).mockReturnValue(null);
    vi.mocked(runStep)
      .mockResolvedValueOnce({ proposalsSynced: 5, votesSynced: 20 })
      .mockResolvedValueOnce({ eventsSynced: 10, snapshotsTaken: 2 });

    const { POST } = await import("@/app/api/cron/sync/route");
    const req = new NextRequest("http://localhost/api/cron/sync", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
    await POST(req);

    expect(runStep).toHaveBeenCalledWith(
      "syncGovernance",
      syncGovernance,
      expect.any(Array),
      "Cron Sync",
    );
    expect(runStep).toHaveBeenCalledWith(
      "syncDelegations",
      syncDelegations,
      expect.any(Array),
      "Cron Sync",
    );
  });
});
