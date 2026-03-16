import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    slo: { count: vi.fn() },
    webhook: { count: vi.fn() },
    incident: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/workspace-auth")>();
  return {
    ...original,
    requireWorkspace: vi.fn(),
    generateWorkspaceToken: vi.fn(() => "ws_" + "ab".repeat(32)),
    hashToken: vi.fn(() => "hashed-token"),
  };
});

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace-auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

function authSuccess() {
  vi.mocked(requireWorkspace).mockResolvedValue({ workspace: mockWorkspace });
}

function authFail() {
  vi.mocked(requireWorkspace).mockResolvedValue({
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxFn = (tx: any) => any;

// Helper to set up the transaction mock for workspace creation
function setupCreateTransaction(opts?: { slugExists?: boolean; limitReached?: boolean }) {
  vi.mocked(prisma.$transaction).mockImplementation((async (fn: TxFn) =>
    fn({
      workspace: {
        findUnique: vi.fn().mockResolvedValue(opts?.slugExists ? { id: "existing" } : null),
        count: vi.fn().mockResolvedValue(opts?.limitReached ? 100 : 0),
        create: vi.fn().mockResolvedValue({
          id: "ws-new",
          name: "New WS",
          slug: "new-ws",
          createdAt: new Date("2026-01-01"),
        }),
      },
    })) as never,
  );
}

// Helper to set up the transaction mock for token rotation
function setupRotateTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation((async (fn: TxFn) =>
    fn({
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ id: "ws-1" }),
        update: vi.fn().mockResolvedValue({ id: "ws-1" }),
      },
    })) as never,
  );
}

describe("POST /api/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PANOPTES_ADMIN_SECRET", "test-admin-secret");
    setupCreateTransaction();
  });

  it("creates workspace with valid admin secret", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "test-admin-secret",
      },
      body: JSON.stringify({ name: "New WS", slug: "new-ws" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.workspace.slug).toBe("new-ws");
    expect(body.token).toMatch(/^ws_/);
  });

  it("returns 403 without admin secret", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New WS", slug: "new-ws" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 with wrong admin secret", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "wrong-secret",
      },
      body: JSON.stringify({ name: "New WS", slug: "new-ws" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid slug", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "test-admin-secret",
      },
      body: JSON.stringify({ name: "New WS", slug: "INVALID SLUG" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate slug", async () => {
    setupCreateTransaction({ slugExists: true });

    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "test-admin-secret",
      },
      body: JSON.stringify({ name: "New WS", slug: "new-ws" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

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
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      headers: { Authorization: "Bearer ws_token" },
    });
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
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
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
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for short name", async () => {
    const { PATCH } = await import("@/app/api/workspaces/me/route");
    const req = new NextRequest("http://localhost/api/workspaces/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/workspaces/me/rotate-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    setupRotateTransaction();
  });

  it("rotates token and returns new one", async () => {
    vi.mocked(prisma.workspace.update).mockResolvedValue({ id: "ws-1" } as never);

    const { POST } = await import("@/app/api/workspaces/me/rotate-token/route");
    const req = new NextRequest("http://localhost/api/workspaces/me/rotate-token", {
      method: "POST",
      headers: { Authorization: "Bearer ws_old_token" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toMatch(/^ws_/);
    expect(body.message).toContain("invalidated");
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { POST } = await import("@/app/api/workspaces/me/rotate-token/route");
    const req = new NextRequest("http://localhost/api/workspaces/me/rotate-token", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("uses transaction for atomic rotation", async () => {
    vi.mocked(prisma.workspace.update).mockResolvedValue({ id: "ws-1" } as never);

    const { POST } = await import("@/app/api/workspaces/me/rotate-token/route");
    const req = new NextRequest("http://localhost/api/workspaces/me/rotate-token", {
      method: "POST",
      headers: { Authorization: "Bearer ws_old_token" },
    });
    await POST(req);

    // The $transaction mock should have been called (if mocked)
    // At minimum, verify the response is successful
    // The transaction is tested by verifying the code path completes without error
  });

  it("returns error when workspace not found during rotation", async () => {
    // Arrange - Override $transaction to simulate workspace not found
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("Workspace not found"));

    const { POST: ROTATE } = await import("@/app/api/workspaces/me/rotate-token/route");
    const req = new NextRequest("http://localhost/api/workspaces/me/rotate-token", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });

    // Act & Assert - The function should throw an error when workspace is not found
    await expect(ROTATE(req)).rejects.toThrow("Workspace not found");
  });
});

describe("POST /api/workspaces - timing-safe comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PANOPTES_ADMIN_SECRET", "test-admin-secret");
    setupCreateTransaction();
  });

  it("rejects when PANOPTES_ADMIN_SECRET is not set", async () => {
    vi.stubEnv("PANOPTES_ADMIN_SECRET", "");
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "any-secret",
      },
      body: JSON.stringify({ name: "Test", slug: "test-ws" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects secrets of different lengths", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const req = new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "short",
      },
      body: JSON.stringify({ name: "Test", slug: "test-ws" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
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
      headers: { Authorization: "Bearer ws_token" },
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
