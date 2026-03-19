import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    slo: { count: vi.fn() },
    webhook: { count: vi.fn() },
    incident: { count: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  requireRole: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { resolveAuth, requireRole } from "@/lib/auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

function authSuccess() {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: { id: "u-1", address: "rai1..." },
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

describe("GET /api/workspaces/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns workspace info with resource counts", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "ws-1",
      name: "Test",
      slug: "test",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    } as never);
    vi.mocked(prisma.slo.count).mockResolvedValue(3);
    vi.mocked(prisma.webhook.count).mockResolvedValue(2);
    vi.mocked(prisma.incident.count).mockResolvedValue(5);

    const { GET } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workspace.slug).toBe("test");
    expect(body.resources.slos).toBe(3);
    expect(body.resources.webhooks).toBe(2);
    expect(body.resources.incidents).toBe(5);
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { GET } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/workspaces/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("updates workspace name", async () => {
    vi.mocked(prisma.workspace.update).mockResolvedValue({
      id: "ws-1",
      name: "Updated Name",
      slug: "test",
    } as never);

    const { PATCH } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workspace.name).toBe("Updated Name");
  });

  it("returns 400 for empty body", async () => {
    const { PATCH } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for short name", async () => {
    const { PATCH } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/workspaces/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("deactivates workspace and returns 204", async () => {
    vi.mocked(prisma.workspace.update).mockResolvedValue({ id: "ws-1", isActive: false } as never);

    const { DELETE } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(204);
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: { isActive: false },
    });
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { DELETE } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });
});
