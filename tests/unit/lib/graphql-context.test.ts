import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/workspace-auth", () => ({
  authenticateWorkspace: vi.fn(),
}));

import { authenticateWorkspace } from "@/lib/workspace-auth";
import { createContext } from "@/lib/graphql/context";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContext", () => {
  it("returns workspace context when authenticated", async () => {
    const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };
    vi.mocked(authenticateWorkspace).mockResolvedValue(mockWorkspace);

    const req = new NextRequest("http://localhost/api/graphql", {
      headers: { Authorization: "Bearer ws_valid-token" },
    });

    const ctx = await createContext(req);
    expect(ctx.workspace).toEqual(mockWorkspace);
  });

  it("returns null workspace when no auth header", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql");
    const ctx = await createContext(req);
    expect(ctx.workspace).toBeNull();
  });

  it("returns null workspace for invalid token", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql", {
      headers: { Authorization: "Bearer ws_invalid-token" },
    });

    const ctx = await createContext(req);
    expect(ctx.workspace).toBeNull();
  });

  it("calls authenticateWorkspace with the request", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql");
    await createContext(req);

    expect(authenticateWorkspace).toHaveBeenCalledTimes(1);
    expect(authenticateWorkspace).toHaveBeenCalledWith(req);
  });

  it("passes through workspace context properties", async () => {
    const workspace = { id: "ws-abc", name: "Production", slug: "production" };
    vi.mocked(authenticateWorkspace).mockResolvedValue(workspace);

    const req = new NextRequest("http://localhost/api/graphql", {
      headers: { Authorization: "Bearer ws_prod-token" },
    });

    const ctx = await createContext(req);
    expect(ctx.workspace?.id).toBe("ws-abc");
    expect(ctx.workspace?.name).toBe("Production");
    expect(ctx.workspace?.slug).toBe("production");
  });
});
