import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    endpoint: { findMany: vi.fn(), findUnique: vi.fn() },
    networkStats: { findFirst: vi.fn() },
    anomaly: { findMany: vi.fn(), count: vi.fn() },
    slo: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), count: vi.fn() },
    incident: { findMany: vi.fn(), count: vi.fn() },
    webhook: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), count: vi.fn() },
    governanceProposal: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 59,
    resetAt: Date.now() + 60000,
  })),
}));

vi.mock("@/lib/api-helpers", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/api-key", () => ({
  authenticateApiKey: vi.fn(),
}));

describe("GraphQL Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects queries exceeding max depth", { timeout: 10_000 }, async () => {
    const { POST } = await import("@/app/api/graphql/route");
    const deepQuery = `{
      validators {
        nodes {
          scores {
            score
            details {
              uptime {
                history {
                  values { id }
                }
              }
            }
          }
        }
      }
    }`;

    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: deepQuery }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors[0].message).toContain("depth");
  });

  it("allows queries within depth limit", async () => {
    const { POST } = await import("@/app/api/graphql/route");
    const shallowQuery = `{ validators { nodes { id moniker } } }`;

    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: shallowQuery }),
    });

    const res = await POST(req);
    // Should not be 400 for depth (may be other error from resolver, but not depth)
    if (res.status === 400) {
      const body = await res.json();
      expect(body.errors[0].message).not.toContain("depth");
    }
  });

  it("rejects queries exceeding max length", async () => {
    const { POST } = await import("@/app/api/graphql/route");
    const longQuery = "{ validators " + " ".repeat(10001) + "{ nodes { id } } }";

    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: longQuery }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors[0].message).toContain("too large");
  });

  it("rejects invalid GraphQL syntax", async () => {
    const { POST } = await import("@/app/api/graphql/route");

    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ this is not valid graphql !!!}" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects __schema introspection query", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { POST } = await import("@/app/api/graphql/route");
    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __schema { types { name } } }" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);

    vi.unstubAllEnvs();
  });

  it("rejects __type introspection query", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { POST } = await import("@/app/api/graphql/route");
    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: '{ __type(name: "Validator") { fields { name } } }',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.errors).toBeDefined();

    vi.unstubAllEnvs();
  });

  it("does not export a GET handler (CSRF prevention)", async () => {
    const route = await import("@/app/api/graphql/route");
    expect(route).not.toHaveProperty("GET");
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const { POST } = await import("@/app/api/graphql/route");
    const req = new NextRequest("http://localhost/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ validators { nodes { id } } }" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
