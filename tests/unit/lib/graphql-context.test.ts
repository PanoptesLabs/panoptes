import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
}));

import { resolveAuth } from "@/lib/auth";
import { createContext } from "@/lib/graphql/context";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContext", () => {
  it("returns workspace context when authenticated", async () => {
    const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };
    vi.mocked(resolveAuth).mockResolvedValue({
      user: { id: "u-1", address: "rai1..." },
      workspace: mockWorkspace,
      role: "admin",
    });

    const req = new NextRequest("http://localhost/api/graphql");

    const ctx = await createContext(req);
    expect(ctx.workspace).toEqual(mockWorkspace);
  });

  it("returns null workspace when no auth", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql");
    const ctx = await createContext(req);
    expect(ctx.workspace).toBeNull();
  });

  it("returns null workspace for anonymous user", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql");

    const ctx = await createContext(req);
    expect(ctx.workspace).toBeNull();
  });

  it("calls resolveAuth with the request", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/graphql");
    await createContext(req);

    expect(resolveAuth).toHaveBeenCalledTimes(1);
    expect(resolveAuth).toHaveBeenCalledWith(req);
  });

  it("passes through workspace context properties", async () => {
    const workspace = { id: "ws-abc", name: "Production", slug: "production" };
    vi.mocked(resolveAuth).mockResolvedValue({
      user: { id: "u-1", address: "rai1..." },
      workspace,
      role: "admin",
    });

    const req = new NextRequest("http://localhost/api/graphql");

    const ctx = await createContext(req);
    expect(ctx.workspace?.id).toBe("ws-abc");
    expect(ctx.workspace?.name).toBe("Production");
    expect(ctx.workspace?.slug).toBe("production");
  });
});
