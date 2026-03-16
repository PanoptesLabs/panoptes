import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    actionRecord: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    endpoint: { count: vi.fn() },
    incident: { findFirst: vi.fn() },
    anomaly: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { publishEvent } from "@/lib/events/publish";
import { canExecute, executeAction, rollbackExpired } from "@/lib/intelligence/policy-actions";
import type { PolicyAction } from "@/types";

const baseContext = {
  workspaceId: "ws-1",
  policyId: "pol-1",
  entityType: "endpoint",
  entityId: "ep-1",
  dryRun: false,
};

describe("canExecute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when under hourly limit", async () => {
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(5);
    expect(await canExecute("ws-1")).toBe(true);
  });

  it("returns false when at or over hourly limit", async () => {
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(10);
    expect(await canExecute("ws-1")).toBe(false);
  });
});

describe("executeAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns dry-run result without side effects", async () => {
    const action: PolicyAction = { type: "log" };
    const result = await executeAction(action, { ...baseContext, dryRun: true });

    expect(result.success).toBe(true);
    expect(result.message).toContain("[DRY RUN]");
  });

  it("returns failure for unknown action type", async () => {
    const action = { type: "unknown_type" } as unknown as PolicyAction;
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown action type");
  });

  it("executes log action successfully", async () => {
    const action: PolicyAction = { type: "log" };
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.type).toBe("log");
  });

  it("rejects routing_exclude for non-endpoint entity", async () => {
    const action: PolicyAction = { type: "routing_exclude" };
    const result = await executeAction(action, {
      ...baseContext,
      entityType: "validator",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("only applies to endpoints");
  });

  it("rejects routing_exclude when minimum healthy endpoints reached", async () => {
    vi.mocked(prisma.endpoint.count).mockResolvedValue(3);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(1);

    const action: PolicyAction = { type: "routing_exclude" };
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot exclude");
  });

  it("executes routing_exclude when enough healthy endpoints", async () => {
    vi.mocked(prisma.endpoint.count).mockResolvedValue(10);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(0);
    vi.mocked(prisma.actionRecord.create).mockResolvedValue({} as never);

    const action: PolicyAction = { type: "routing_exclude" };
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.data?.expiresAt).toBeDefined();
  });

  it("returns existing incident instead of creating duplicate", async () => {
    vi.mocked(prisma.incident.findFirst).mockResolvedValue({
      id: "inc-existing",
    } as never);

    const action: PolicyAction = { type: "incident_create" };
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(true);
    expect(result.data?.incidentId).toBe("inc-existing");
  });

  it("publishes webhook event", async () => {
    vi.mocked(publishEvent).mockResolvedValue(null);

    const action: PolicyAction = { type: "webhook" };
    const result = await executeAction(action, baseContext);

    expect(result.success).toBe(true);
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "policy.action_executed" }),
    );
  });
});

describe("rollbackExpired", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates expired actions and returns count", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 3 });

    const count = await rollbackExpired();
    expect(count).toBe(3);
    expect(prisma.actionRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rolledBackAt: null }),
      }),
    );
  });

  it("returns 0 when no expired actions", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 0 });
    expect(await rollbackExpired()).toBe(0);
  });
});
