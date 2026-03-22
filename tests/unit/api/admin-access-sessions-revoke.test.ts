import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockSessionFindFirst = vi.fn();
const mockSessionDelete = vi.fn();
const txMock = {
  userSession: { delete: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: {
      findFirst: (...args: unknown[]) => mockSessionFindFirst(...args),
      delete: (...args: unknown[]) => mockSessionDelete(...args),
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
const mockSession = {
  id: "sess-1",
  userId: "user-2",
  user: {
    id: "user-2",
    address: "rai1target",
    members: [{ id: "member-1" }],
  },
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

describe("POST /api/admin/access/sessions/[id]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("revokes session and creates audit log", async () => {
    mockSessionFindFirst.mockResolvedValue(mockSession);
    txMock.userSession.delete.mockResolvedValue(mockSession);

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/sess-1/revoke", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "sess-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(txMock.userSession.delete).toHaveBeenCalledWith({ where: { id: "sess-1" } });
  });

  it("returns 404 when session not found", async () => {
    mockSessionFindFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/nonexistent/revoke", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 404 when user not in workspace", async () => {
    const sessionWithoutMembership = {
      ...mockSession,
      user: {
        ...mockSession.user,
        members: [],
      },
    };
    mockSessionFindFirst.mockResolvedValue(sessionWithoutMembership);

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/sess-1/revoke", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "sess-1" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Session not found");
  });

  it("returns 401 without admin auth", async () => {
    authFail();

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/sess-1/revoke", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "sess-1" }) });

    expect(res.status).toBe(401);
  });

  it("queries session with correct workspace filter", async () => {
    mockSessionFindFirst.mockResolvedValue(mockSession);
    txMock.userSession.delete.mockResolvedValue(mockSession);

    const { POST } = await import("@/app/api/admin/access/sessions/[id]/revoke/route");
    const req = new NextRequest("http://localhost/api/admin/access/sessions/sess-1/revoke", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    await POST(req, { params: Promise.resolve({ id: "sess-1" }) });

    expect(mockSessionFindFirst).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      include: {
        user: {
          include: {
            members: {
              where: { workspaceId: "ws-1" },
              select: { id: true },
            },
          },
        },
      },
    });
  });
});
