import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSessionDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: {
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  hashToken: vi.fn((t: string) => `hashed_${t}`),
}));

vi.mock("@/lib/constants", () => ({
  AUTH_DEFAULTS: {
    COOKIE_NAME: "__Host-panoptes_session",
  },
}));

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes session and clears cookie", async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "__Host-panoptes_session=test-token" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { token: "hashed_test-token" },
    });

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("__Host-panoptes_session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("succeeds without cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("clears cookie with correct attributes", async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "__Host-panoptes_session=test-token" },
    });
    const res = await POST(req);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie?.toLowerCase()).toContain("samesite=strict");
    expect(setCookie).toContain("Path=/");
  });

  it("handles database errors gracefully", async () => {
    mockSessionDeleteMany.mockRejectedValue(new Error("Database error"));

    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "__Host-panoptes_session=test-token" },
    });

    await expect(POST(req)).rejects.toThrow("Database error");
  });

  it("hashes token before querying database", async () => {
    const { hashToken } = await import("@/lib/workspace-auth");
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "__Host-panoptes_session=my-secret-token" },
    });
    await POST(req);

    expect(hashToken).toHaveBeenCalledWith("my-secret-token");
    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { token: "hashed_my-secret-token" },
    });
  });
});
