import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/workspace-auth")>();
  return {
    ...original,
    authenticateWorkspace: vi.fn(),
  };
});

import { authenticateWorkspace } from "@/lib/workspace-auth";

describe("POST /api/workspaces/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace info for valid token", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue({
      id: "ws-1",
      name: "Test Workspace",
      slug: "test-ws",
    });

    const { POST } = await import("@/app/api/workspaces/verify/route");
    const req = new NextRequest("http://localhost/api/workspaces/verify", {
      method: "POST",
      headers: { Authorization: "Bearer ws_valid_token" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workspace.id).toBe("ws-1");
    expect(body.workspace.name).toBe("Test Workspace");
    expect(body.workspace.slug).toBe("test-ws");
  });

  it("returns 401 for invalid token", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const { POST } = await import("@/app/api/workspaces/verify/route");
    const req = new NextRequest("http://localhost/api/workspaces/verify", {
      method: "POST",
      headers: { Authorization: "Bearer ws_invalid" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 without authorization header", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const { POST } = await import("@/app/api/workspaces/verify/route");
    const req = new NextRequest("http://localhost/api/workspaces/verify", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("includes rate limit headers", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue({
      id: "ws-1",
      name: "Test",
      slug: "test",
    });

    const { POST } = await import("@/app/api/workspaces/verify/route");
    const req = new NextRequest("http://localhost/api/workspaces/verify", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req);

    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
  });
});
