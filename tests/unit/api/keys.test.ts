import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
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
  redactForRole: vi.fn((data: unknown) => data),
  rateLimitForRole: vi.fn((role: string) => (role === "anonymous" ? 30 : 120)),
}));

vi.mock("@/lib/api-key", () => ({
  generateApiKey: vi.fn(() => "pk_test1234567890abcdef"),
  hashApiKey: vi.fn(() => "hash123"),
  getKeyPrefix: vi.fn(() => "pk_test12345"),
}));

vi.mock("@/lib/api-key-validation", () => ({
  validateApiKeyCreate: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { resolveAuth, requireRole } from "@/lib/auth";
import { validateApiKeyCreate } from "@/lib/api-key-validation";

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

describe("GET /api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    authFail();

    const { GET } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns keys list", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      {
        id: "key1",
        name: "Test Key",
        keyPrefix: "pk_abc",
        tier: "free",
        isActive: true,
        rateLimit: 60,
        dailyQuota: 1000,
        monthlyQuota: 10000,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
      },
    ] as never);

    const { GET } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].name).toBe("Test Key");
  });
});

describe("POST /api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    authFail();

    const { POST } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    authSuccess();
    vi.mocked(validateApiKeyCreate).mockReturnValue({ error: "Name required" });

    const { POST } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name required");
  });

  it("creates key successfully", async () => {
    authSuccess();
    vi.mocked(validateApiKeyCreate).mockReturnValue({
      name: "Test Key",
      tier: "free",
      expiresAt: null,
    } as never);

    const createdKey = {
      id: "key1",
      name: "Test Key",
      keyPrefix: "pk_test12345",
      tier: "free",
      isActive: true,
      rateLimit: 60,
      dailyQuota: 1000,
      monthlyQuota: 10000,
      expiresAt: null,
      createdAt: new Date(),
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        $queryRaw: vi.fn(),
        apiKey: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue(createdKey),
        },
      };
      return (fn as (tx: unknown) => Promise<unknown>)(tx);
    });

    const { POST } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Test Key" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("Test Key");
    expect(body.key).toBeDefined();
  });

  it("returns 409 when key limit reached", async () => {
    authSuccess();
    vi.mocked(validateApiKeyCreate).mockReturnValue({
      name: "Test Key",
      tier: "free",
      expiresAt: null,
    } as never);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        $queryRaw: vi.fn(),
        apiKey: {
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn(),
        },
      };
      return (fn as (tx: unknown) => Promise<unknown>)(tx);
    });

    const { POST } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Test Key" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it("returns 400 for malformed JSON", async () => {
    authSuccess();

    const { POST } = await import("@/app/api/keys/route");
    const req = new NextRequest("http://localhost/api/keys", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/keys/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent key", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/keys/[id]/route");
    const req = new NextRequest("http://localhost/api/keys/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("returns key details", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      id: "key1",
      name: "Test",
      keyPrefix: "pk_abc",
      tier: "free",
      isActive: true,
      rateLimit: 60,
      dailyQuota: 1000,
      monthlyQuota: 10000,
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date(),
    } as never);

    const { GET } = await import("@/app/api/keys/[id]/route");
    const req = new NextRequest("http://localhost/api/keys/key1");
    const res = await GET(req, { params: Promise.resolve({ id: "key1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.key.name).toBe("Test");
  });
});

describe("DELETE /api/keys/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent key", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/keys/[id]/route");
    const req = new NextRequest("http://localhost/api/keys/nonexistent", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);
  });

  it("deactivates key successfully", async () => {
    authSuccess();
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({ id: "key1" } as never);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never);

    const { DELETE } = await import("@/app/api/keys/[id]/route");
    const req = new NextRequest("http://localhost/api/keys/key1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "key1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("API key deactivated");
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key1" },
      data: { isActive: false },
    });
  });
});
