import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => {
  const workspaceMemberModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const apiKeyModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const userSessionModel = {
    findFirst: vi.fn(),
    delete: vi.fn(),
  };
  const auditLogModel = {
    create: vi.fn(),
  };
  return {
    prisma: {
      workspaceMember: workspaceMemberModel,
      apiKey: apiKeyModel,
      userSession: userSessionModel,
      auditLog: auditLogModel,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
        fn({
          workspaceMember: workspaceMemberModel,
          apiKey: apiKeyModel,
          userSession: userSessionModel,
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

describe("GET /api/admin/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns members and API keys for admin", async () => {
    authSuccess();
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([
      {
        id: "m-1",
        user: { id: "u-1", address: "rai1abc", sessions: [] },
        role: "viewer",
        createdAt: new Date("2026-01-01"),
      },
    ] as never);
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      {
        id: "key-1",
        name: "Test Key",
        keyPrefix: "pk_abc",
        tier: "free",
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-01-01"),
      },
    ] as never);

    const { GET } = await import("@/app/api/admin/access/route");
    const req = new NextRequest("http://localhost/api/admin/access");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members).toHaveLength(1);
    expect(body.members[0].address).toBe("rai1abc");
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0].name).toBe("Test Key");
    expect(body.apiKeys[0]).not.toHaveProperty("keyHash");
  });

  it("returns 403 for non-admin", async () => {
    authNonAdmin();

    const { GET } = await import("@/app/api/admin/access/route");
    const req = new NextRequest("http://localhost/api/admin/access");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns 500 when database throws", async () => {
    authSuccess();
    vi.mocked(prisma.workspaceMember.findMany).mockRejectedValue(new Error("DB connection lost"));

    const { GET } = await import("@/app/api/admin/access/route");
    const req = new NextRequest("http://localhost/api/admin/access");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});

describe("POST /api/admin/access/members/:id/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("changes role successfully within transaction", async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: "m-1",
      userId: "u-other",
      role: "viewer",
      user: { id: "u-other", address: "rai1other" },
    } as never);
    vi.mocked(prisma.workspaceMember.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/m-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "m-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.previousRole).toBe("viewer");
    expect(body.newRole).toBe("editor");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        action: "member.role_changed",
      }),
    });
  });

  it("returns 400 for invalid role", async () => {
    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/m-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "superadmin" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "m-1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 for self-demotion", async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: "m-admin",
      userId: "user-admin",
      role: "admin",
      user: { id: "user-admin", address: "rai1admin" },
    } as never);

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/m-admin/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "viewer" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "m-admin" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("own role");
  });

  it("returns 404 for unknown member", async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/m-unknown/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "m-unknown" }) });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/access/sessions/:id/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("revokes session within transaction", async () => {
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue({
      id: "sess-1",
      userId: "u-1",
      user: { members: [{ id: "m-1" }] },
    } as never);
    vi.mocked(prisma.userSession.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/sess-1/revoke", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "sess-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("POST /api/admin/access/keys/:id/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("disables API key within transaction", async () => {
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      id: "key-1",
      name: "Test Key",
      keyPrefix: "pk_abc",
    } as never);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/key-1/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "key-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
