import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

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

describe("GET /api/admin/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated audit logs", async () => {
    authSuccess();
    const mockLogs = [
      {
        id: "log-1",
        actorAddress: "rai1admin",
        action: "member.role_changed",
        resourceType: "WorkspaceMember",
        resourceId: "m-1",
        metadata: null,
        createdAt: new Date(),
      },
    ];
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/admin/audit/route");
    const req = new NextRequest("http://localhost/api/admin/audit?limit=10&offset=0");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it("filters by action", async () => {
    authSuccess();
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/admin/audit/route");
    const req = new NextRequest("http://localhost/api/admin/audit?action=session.revoked");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-1", action: "session.revoked" }),
      }),
    );
  });

  it("filters by resourceType", async () => {
    authSuccess();
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/admin/audit/route");
    const req = new NextRequest("http://localhost/api/admin/audit?resourceType=ApiKey");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-1", resourceType: "ApiKey" }),
      }),
    );
  });

  it("returns 403 for non-admin", async () => {
    authNonAdmin();

    const { GET } = await import("@/app/api/admin/audit/route");
    const req = new NextRequest("http://localhost/api/admin/audit");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});
