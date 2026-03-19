import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  };
});

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/api-key", () => ({
  getApiKeyUsage: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { resolveAuth, requireRole } from "@/lib/auth";
import { getApiKeyUsage } from "@/lib/api-key";

const mockWorkspace = { id: "ws1", name: "Test", slug: "test" };

function authSuccess(role = "admin") {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: null,
    workspace: mockWorkspace,
    role: role as "admin" | "editor" | "member" | "viewer" | "anonymous",
  });
  vi.mocked(requireRole).mockReturnValue(null);
}

function authFail() {
  vi.mocked(resolveAuth).mockResolvedValue(null);
  vi.mocked(requireRole).mockReturnValue(
    NextResponse.json({ error: "Authentication required" }, { status: 401 }),
  );
}

describe("GET /api/keys/[id]/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent key", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/keys/[id]/usage/route");
    const req = new NextRequest("http://localhost/api/keys/nonexistent/usage");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns usage data", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      id: "key1",
      dailyQuota: 1000,
      monthlyQuota: 10000,
    } as never);
    vi.mocked(getApiKeyUsage).mockResolvedValue({
      daily: [{ period: "2026-03-15", count: 42 }],
      monthly: [{ period: "2026-03", count: 500 }],
    });

    const { GET } = await import("@/app/api/keys/[id]/usage/route");
    const req = new NextRequest("http://localhost/api/keys/key1/usage");
    const res = await GET(req, { params: Promise.resolve({ id: "key1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keyId).toBe("key1");
    expect(body.dailyQuota).toBe(1000);
    expect(body.usage.daily).toHaveLength(1);
  });

  it("returns 401 without auth", async () => {
    authFail();

    const { GET } = await import("@/app/api/keys/[id]/usage/route");
    const req = new NextRequest("http://localhost/api/keys/key1/usage");
    const res = await GET(req, { params: Promise.resolve({ id: "key1" }) });

    expect(res.status).toBe(401);
  });
});
