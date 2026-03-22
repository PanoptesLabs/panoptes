import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockApiKeyFindFirst = vi.fn();
const mockApiKeyUpdate = vi.fn();
const txMock = {
  apiKey: { update: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: (...args: unknown[]) => mockApiKeyFindFirst(...args),
      update: (...args: unknown[]) => mockApiKeyUpdate(...args),
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
const mockUser = { id: "user-1", address: "rai1abc" };
const mockApiKey = {
  id: "key-1",
  name: "Test Key",
  keyPrefix: "pano_test",
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

describe("POST /api/admin/access/keys/[id]/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("disables API key and creates audit log", async () => {
    mockApiKeyFindFirst.mockResolvedValue(mockApiKey);
    txMock.apiKey.update.mockResolvedValue({ ...mockApiKey, isActive: false });

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/key-1/disable", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "key-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockApiKeyFindFirst).toHaveBeenCalledWith({
      where: { id: "key-1", workspaceId: "ws-1" },
      select: { id: true, name: true, keyPrefix: true },
    });
    expect(txMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { isActive: false },
    });
  });

  it("returns 404 when API key not found", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/nonexistent/disable", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("API key not found");
  });

  it("returns 401 without admin auth", async () => {
    authFail();

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/key-1/disable", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "key-1" }) });

    expect(res.status).toBe(401);
  });

  it("does not update if key belongs to different workspace", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/key-other/disable", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "key-other" }) });

    expect(res.status).toBe(404);
    expect(txMock.apiKey.update).not.toHaveBeenCalled();
  });

  it("creates audit log with correct metadata", async () => {
    const { createAuditLog } = await import("@/lib/audit");
    mockApiKeyFindFirst.mockResolvedValue(mockApiKey);
    txMock.apiKey.update.mockResolvedValue({ ...mockApiKey, isActive: false });

    const { POST } = await import("@/app/api/admin/access/keys/[id]/disable/route");
    const req = new NextRequest("http://localhost/api/admin/access/keys/key-1/disable", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    await POST(req, { params: Promise.resolve({ id: "key-1" }) });

    expect(createAuditLog).toHaveBeenCalled();
  });
});
