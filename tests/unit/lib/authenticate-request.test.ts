import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/workspace-auth", () => ({
  authenticateWorkspace: vi.fn(),
  extractApiKey: vi.fn(),
}));

vi.mock("@/lib/api-key", () => ({
  authenticateApiKey: vi.fn(),
  checkQuotas: vi.fn(),
}));

import { authenticateWorkspace, extractApiKey } from "@/lib/workspace-auth";
import { authenticateApiKey, checkQuotas } from "@/lib/api-key";
import { authenticateRequest } from "@/lib/authenticate-request";

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no auth provided", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);
    vi.mocked(extractApiKey).mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/test");
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("returns bearer context when workspace token valid", async () => {
    const workspace = { id: "ws1", name: "Test", slug: "test" };
    vi.mocked(authenticateWorkspace).mockResolvedValue(workspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer ws_test" },
    });
    const result = await authenticateRequest(req);
    expect(result).toEqual({
      workspace,
      source: "bearer",
    });
  });

  it("falls back to api-key when bearer fails", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);
    vi.mocked(extractApiKey).mockReturnValue("pk_test");
    vi.mocked(authenticateApiKey).mockResolvedValue({
      id: "key1",
      workspaceId: "ws1",
      tier: "free",
      rateLimit: 60,
      workspace: { id: "ws1", name: "Test", slug: "test" },
    });
    vi.mocked(checkQuotas).mockResolvedValue({ allowed: true });

    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "pk_test" },
    });
    const result = await authenticateRequest(req);
    expect(result).toEqual({
      workspace: { id: "ws1", name: "Test", slug: "test" },
      source: "api-key",
      apiKeyId: "key1",
      tier: "free",
    });
  });

  it("returns null when api-key is invalid", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);
    vi.mocked(extractApiKey).mockReturnValue("pk_invalid");
    vi.mocked(authenticateApiKey).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "pk_invalid" },
    });
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("returns null when quota exceeded", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);
    vi.mocked(extractApiKey).mockReturnValue("pk_test");
    vi.mocked(authenticateApiKey).mockResolvedValue({
      id: "key1",
      workspaceId: "ws1",
      tier: "free",
      rateLimit: 60,
      workspace: { id: "ws1", name: "Test", slug: "test" },
    });
    vi.mocked(checkQuotas).mockResolvedValue({ allowed: false, reason: "Daily quota exceeded" });

    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "pk_test" },
    });
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("prefers bearer token over api-key", async () => {
    const workspace = { id: "ws1", name: "Test", slug: "test" };
    vi.mocked(authenticateWorkspace).mockResolvedValue(workspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        Authorization: "Bearer ws_test",
        "x-api-key": "pk_test",
      },
    });
    const result = await authenticateRequest(req);
    expect(result?.source).toBe("bearer");
    expect(authenticateApiKey).not.toHaveBeenCalled();
  });
});
