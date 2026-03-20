import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => {
  const webhookModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const policyModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const auditLogModel = {
    create: vi.fn(),
  };
  return {
    prisma: {
      webhook: webhookModel,
      policy: policyModel,
      incident: { findMany: vi.fn() },
      auditLog: auditLogModel,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
        fn({
          webhook: webhookModel,
          policy: policyModel,
          auditLog: auditLogModel,
        }),
      ),
    },
  };
});

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "120" } })),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  requireRole: vi.fn(),
  rateLimitForRole: vi.fn(() => 120),
}));

import { prisma } from "@/lib/db";
import { resolveAuth, requireRole } from "@/lib/auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

function authSuccess() {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: { id: "user-admin", address: "rai1admin" },
    workspace: mockWorkspace,
    role: "admin",
  });
  vi.mocked(requireRole).mockReturnValue(null);
}

function authNonAdmin() {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: { id: "user-viewer", address: "rai1viewer" },
    workspace: mockWorkspace,
    role: "viewer",
  });
  vi.mocked(requireRole).mockReturnValue(
    NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
  );
}

describe("GET /api/admin/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns webhooks, policies, and incidents for admin", async () => {
    authSuccess();
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh-1",
        name: "Hook 1",
        isActive: true,
        createdAt: new Date(),
        deliveries: [
          { success: true, createdAt: new Date() },
          { success: true, createdAt: new Date() },
          { success: false, createdAt: new Date() },
        ],
      },
    ] as never);
    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "pol-1",
        name: "Policy 1",
        isActive: true,
        dryRun: false,
        lastTriggeredAt: new Date(),
        createdAt: new Date(),
        _count: { executions: 12 },
      },
    ] as never);
    vi.mocked(prisma.incident.findMany).mockResolvedValue([
      {
        id: "inc-1",
        title: "High latency",
        status: "open",
        severity: "high",
        detectedAt: new Date(),
        resolvedAt: null,
      },
    ] as never);

    const { GET } = await import("@/app/api/admin/operations/route");
    const req = new NextRequest("http://localhost/api/admin/operations");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.webhooks).toHaveLength(1);
    expect(body.webhooks[0].totalDeliveries).toBe(3);
    expect(body.webhooks[0].successRate).toBeCloseTo(2 / 3);
    expect(body.policies).toHaveLength(1);
    expect(body.policies[0].executionCount).toBe(12);
    expect(body.recentIncidents).toHaveLength(1);
  });

  it("returns 403 for non-admin", async () => {
    authNonAdmin();

    const { GET } = await import("@/app/api/admin/operations/route");
    const req = new NextRequest("http://localhost/api/admin/operations");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns 500 when database throws", async () => {
    authSuccess();
    vi.mocked(prisma.webhook.findMany).mockRejectedValue(new Error("DB connection lost"));

    const { GET } = await import("@/app/api/admin/operations/route");
    const req = new NextRequest("http://localhost/api/admin/operations");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});

describe("POST /api/admin/operations/webhooks/:id/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("disables webhook within transaction", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue({
      id: "wh-1",
      name: "Hook 1",
    } as never);
    vi.mocked(prisma.webhook.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { POST } = await import("@/app/api/admin/operations/webhooks/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/operations/webhooks/wh-1/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        action: "webhook.disabled",
      }),
    });
  });

  it("returns 404 for webhook in another workspace", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/operations/webhooks/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/operations/webhooks/wh-other/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-other" }) });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/operations/policies/:id/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("disables policy within transaction", async () => {
    vi.mocked(prisma.policy.findFirst).mockResolvedValue({
      id: "pol-1",
      name: "Policy 1",
    } as never);
    vi.mocked(prisma.policy.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { POST } = await import("@/app/api/admin/operations/policies/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/operations/policies/pol-1/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "pol-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        action: "policy.disabled",
      }),
    });
  });

  it("returns 404 for policy in another workspace", async () => {
    vi.mocked(prisma.policy.findFirst).mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/operations/policies/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/operations/policies/pol-other/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "pol-other" }) });

    expect(res.status).toBe(404);
  });
});
