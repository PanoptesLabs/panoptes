import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockFindFirstSession = vi.fn();
const mockFindFirstWorkspace = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: { findFirst: (...args: unknown[]) => mockFindFirstSession(...args) },
    workspace: { findFirst: (...args: unknown[]) => mockFindFirstWorkspace(...args) },
  },
}));

vi.mock("@/lib/workspace-auth", () => ({
  hashToken: vi.fn((t: string) => `hashed_${t}`),
}));

import { resolveAuth, hasRole, requireRole, redactForRole, rateLimitForRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";

// --- Fixtures ---

const publicWorkspace = { id: "ws-pub", name: "Republic Community", slug: "republic" };

const mockUser = {
  id: "user-1",
  address: "rai1abc123",
  members: [
    {
      id: "mem-1",
      workspaceId: "ws-pub",
      userId: "user-1",
      role: "member",
      workspace: publicWorkspace,
    },
  ],
};

const mockSession = {
  id: "sess-1",
  userId: "user-1",
  token: "hashed_session-token",
  nonce: null,
  expiresAt: new Date(Date.now() + 86400000),
  user: mockUser,
};

// --- Tests ---

describe("resolveAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves cookie session to user with workspace member role", async () => {
    mockFindFirstSession.mockResolvedValue(mockSession);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "panoptes_session=session-token" },
    });
    const auth = await resolveAuth(req);

    expect(auth).not.toBeNull();
    expect(auth!.user).toEqual({ id: "user-1", address: "rai1abc123" });
    expect(auth!.workspace).toEqual(publicWorkspace);
    expect(auth!.role).toBe("member");
  });

  it("falls back to viewer when user has no public workspace membership", async () => {
    const userNoMember = { ...mockUser, members: [] };
    mockFindFirstSession.mockResolvedValue({ ...mockSession, user: userNoMember });
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "panoptes_session=session-token" },
    });
    const auth = await resolveAuth(req);

    expect(auth!.user).toEqual({ id: "user-1", address: "rai1abc123" });
    expect(auth!.role).toBe("viewer");
  });

  it("ignores Bearer ws_ token (removed auth path) and falls back to anonymous", async () => {
    mockFindFirstSession.mockResolvedValue(null);
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer ws_testtoken" },
    });
    const auth = await resolveAuth(req);

    expect(auth!.user).toBeNull();
    expect(auth!.workspace).toEqual(publicWorkspace);
    expect(auth!.role).toBe("anonymous");
  });

  it("resolves anonymous with public workspace", async () => {
    mockFindFirstSession.mockResolvedValue(null);
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test");
    const auth = await resolveAuth(req);

    expect(auth!.user).toBeNull();
    expect(auth!.role).toBe("anonymous");
  });

  it("returns null when no public workspace exists", async () => {
    mockFindFirstSession.mockResolvedValue(null);
    mockFindFirstWorkspace.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/test");
    const auth = await resolveAuth(req);

    expect(auth).toBeNull();
  });

  it("ignores expired session and falls back to anonymous", async () => {
    mockFindFirstSession.mockResolvedValue(null); // expired sessions not returned by query
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { cookie: "panoptes_session=expired-token" },
    });
    const auth = await resolveAuth(req);

    expect(auth!.role).toBe("anonymous");
  });

  it("cookie session takes priority when Bearer ws_ token is also present", async () => {
    // Bearer ws_ path removed — cookie session should resolve normally
    mockFindFirstSession.mockResolvedValue(mockSession);
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        cookie: "panoptes_session=session-token",
        authorization: "Bearer ws_testtoken",
      },
    });
    const auth = await resolveAuth(req);

    // Cookie session resolves to member role (Bearer ws_ ignored)
    expect(auth!.role).toBe("member");
    expect(auth!.user).toEqual({ id: "user-1", address: "rai1abc123" });
  });

  it("ignores non-ws_ Bearer tokens for workspace auth", async () => {
    mockFindFirstSession.mockResolvedValue(null);
    mockFindFirstWorkspace.mockResolvedValue(publicWorkspace);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer pk_someapikey" },
    });
    const auth = await resolveAuth(req);

    // Should fall through to anonymous since pk_ is not ws_
    expect(auth!.role).toBe("anonymous");
  });
});

describe("hasRole", () => {
  it("returns true when current role equals required", () => {
    expect(hasRole("editor", "editor")).toBe(true);
  });

  it("returns true when current role exceeds required", () => {
    expect(hasRole("admin", "viewer")).toBe(true);
  });

  it("returns false when current role is below required", () => {
    expect(hasRole("viewer", "editor")).toBe(false);
  });

  it("returns false for anonymous below viewer", () => {
    expect(hasRole("anonymous", "viewer")).toBe(false);
  });

  it("returns true for anonymous at anonymous", () => {
    expect(hasRole("anonymous", "anonymous")).toBe(true);
  });

  it("handles unknown roles as 0", () => {
    expect(hasRole("unknown", "viewer")).toBe(false);
  });
});

describe("requireRole", () => {
  const headers = { "X-RateLimit-Limit": "60" };

  it("returns null when role is sufficient", () => {
    const auth: AuthContext = {
      user: { id: "u1", address: "rai1x" },
      workspace: publicWorkspace,
      role: "editor",
    };
    expect(requireRole(auth, "editor", headers)).toBeNull();
  });

  it("returns 503 when auth is null", async () => {
    const res = requireRole(null, "viewer", headers)!;
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("no public workspace");
  });

  it("returns 401 for anonymous trying to access viewer-only", async () => {
    const auth: AuthContext = {
      user: null,
      workspace: publicWorkspace,
      role: "anonymous",
    };
    const res = requireRole(auth, "viewer", headers)!;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Authentication required");
  });

  it("returns 403 for viewer trying to access editor-only", async () => {
    const auth: AuthContext = {
      user: { id: "u1", address: "rai1x" },
      workspace: publicWorkspace,
      role: "viewer",
    };
    const res = requireRole(auth, "editor", headers)!;
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Insufficient permissions");
  });

  it("includes rate limit headers on error responses", () => {
    const auth: AuthContext = {
      user: null,
      workspace: publicWorkspace,
      role: "anonymous",
    };
    const res = requireRole(auth, "viewer", headers)!;
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("admin passes any role requirement", () => {
    const auth: AuthContext = {
      user: null,
      workspace: publicWorkspace,
      role: "admin",
    };
    expect(requireRole(auth, "admin")).toBeNull();
    expect(requireRole(auth, "editor")).toBeNull();
    expect(requireRole(auth, "viewer")).toBeNull();
    expect(requireRole(auth, "anonymous")).toBeNull();
  });
});

describe("redactForRole", () => {
  const redactions = [
    { field: "url" as const, minRole: "member" as const, mask: "https://***" },
    { field: "keyPrefix" as const, minRole: "member" as const, mask: "pk_***" },
  ];

  it("masks fields for anonymous", () => {
    const data = { id: "1", url: "https://example.com/hook", keyPrefix: "pk_abc123" };
    const result = redactForRole(data, "anonymous", redactions);
    expect(result.url).toBe("https://***");
    expect(result.keyPrefix).toBe("pk_***");
    expect(result.id).toBe("1");
  });

  it("masks fields for viewer", () => {
    const data = { id: "1", url: "https://example.com/hook", keyPrefix: "pk_abc123" };
    const result = redactForRole(data, "viewer", redactions);
    expect(result.url).toBe("https://***");
    expect(result.keyPrefix).toBe("pk_***");
  });

  it("shows full data for member", () => {
    const data = { id: "1", url: "https://example.com/hook", keyPrefix: "pk_abc123" };
    const result = redactForRole(data, "member", redactions);
    expect(result.url).toBe("https://example.com/hook");
    expect(result.keyPrefix).toBe("pk_abc123");
  });

  it("shows full data for admin", () => {
    const data = { id: "1", url: "https://example.com/hook", keyPrefix: "pk_abc123" };
    const result = redactForRole(data, "admin", redactions);
    expect(result.url).toBe("https://example.com/hook");
    expect(result.keyPrefix).toBe("pk_abc123");
  });

  it("uses default mask when not specified", () => {
    const data = { secret: "mysecret" };
    const result = redactForRole(data, "anonymous", [
      { field: "secret" as const, minRole: "member" as const },
    ]);
    expect(result.secret).toBe("***");
  });
});

describe("rateLimitForRole", () => {
  it("returns 30 for anonymous", () => {
    expect(rateLimitForRole("anonymous")).toBe(30);
  });

  it("returns 120 for viewer", () => {
    expect(rateLimitForRole("viewer")).toBe(120);
  });

  it("returns 120 for member", () => {
    expect(rateLimitForRole("member")).toBe(120);
  });

  it("returns 120 for admin", () => {
    expect(rateLimitForRole("admin")).toBe(120);
  });
});
