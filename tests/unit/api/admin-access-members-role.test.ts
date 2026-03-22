import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockMemberFindFirst = vi.fn();
const mockMemberUpdate = vi.fn();
const txMock = {
  workspaceMember: { update: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: {
      findFirst: (...args: unknown[]) => mockMemberFindFirst(...args),
      update: (...args: unknown[]) => mockMemberUpdate(...args),
    },
    $transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  requireRole: vi.fn(),
  rateLimitForRole: vi.fn((role: string) => (role === "anonymous" ? 30 : 120)),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
}));

import { resolveAuth, requireRole } from "@/lib/auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };
const mockUser = { id: "user-1", address: "rai1admin" };
const mockTargetMember = {
  id: "member-1",
  userId: "user-2",
  workspaceId: "ws-1",
  role: "viewer",
  user: { id: "user-2", address: "rai1target" },
};

function authSuccess() {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: mockUser,
    workspace: mockWorkspace,
    role: "admin",
  });
  vi.mocked(requireRole).mockReturnValue(null);
}

function authFail() {
  vi.mocked(resolveAuth).mockResolvedValue(null);
  vi.mocked(requireRole).mockReturnValue(
    NextResponse.json({ error: "Authentication required" }, { status: 401 }),
  );
}

describe("POST /api/admin/access/members/[id]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("updates member role successfully", async () => {
    mockMemberFindFirst.mockResolvedValue(mockTargetMember);
    txMock.workspaceMember.update.mockResolvedValue({ ...mockTargetMember, role: "editor" });

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ role: "editor" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.previousRole).toBe("viewer");
    expect(body.newRole).toBe("editor");
    expect(txMock.workspaceMember.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { role: "editor" },
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: "invalid json",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 for invalid role", async () => {
    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ role: "superadmin" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid role");
  });

  it("returns 400 for missing role field", async () => {
    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid role");
  });

  it("returns 404 when member not found", async () => {
    mockMemberFindFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/nonexistent/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ role: "editor" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Member not found");
  });

  it("returns 400 when trying to change own role", async () => {
    const selfMember = {
      ...mockTargetMember,
      userId: "user-1",
    };
    mockMemberFindFirst.mockResolvedValue(selfMember);

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ role: "viewer" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot change your own role");
  });

  it("returns 401 without admin auth", async () => {
    authFail();

    const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
    const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "editor" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

    expect(res.status).toBe(401);
  });

  it("accepts all valid role values", async () => {
    const validRoles = ["viewer", "member", "editor", "admin"];

    for (const role of validRoles) {
      vi.clearAllMocks();
      authSuccess();
      mockMemberFindFirst.mockResolvedValue(mockTargetMember);
      txMock.workspaceMember.update.mockResolvedValue({ ...mockTargetMember, role });

      const { POST } = await import("@/app/api/admin/access/members/[id]/role/route");
      const req = new NextRequest("http://localhost/api/admin/access/members/member-1/role", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
        body: JSON.stringify({ role }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "member-1" }) });

      expect(res.status).toBe(200);
    }
  });
});
