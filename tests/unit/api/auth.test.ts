import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockUserUpsert = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionFindFirst = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockWorkspaceFindFirst = vi.fn();
const mockMemberUpsert = vi.fn();
const mockSessionDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { upsert: (...args: unknown[]) => mockUserUpsert(...args) },
    userSession: {
      create: (...args: unknown[]) => mockSessionCreate(...args),
      findFirst: (...args: unknown[]) => mockSessionFindFirst(...args),
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
      delete: (...args: unknown[]) => mockSessionDelete(...args),
    },
    workspace: { findFirst: (...args: unknown[]) => mockWorkspaceFindFirst(...args) },
    workspaceMember: { upsert: (...args: unknown[]) => mockMemberUpsert(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({
    headers: { "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": "59", "X-RateLimit-Reset": "1700000000" },
  })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  hashToken: vi.fn((t: string) => `hashed_${t}`),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  rateLimitForRole: vi.fn((role: string) => (role === "anonymous" ? 30 : 120)),
}));

vi.mock("@/lib/signature", () => ({
  verifySignatureWithDiag: vi.fn(),
}));

// --- Tests ---

describe("POST /api/auth/nonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nonce and sessionId for valid address", async () => {
    mockUserUpsert.mockResolvedValue({ id: "user-1", address: "rai1abc123def456ghi789jkl012mno345pqrs6789" });
    mockSessionCreate.mockResolvedValue({ id: "sess-1" });

    const { POST } = await import("@/app/api/auth/nonce/route");
    const req = new NextRequest("http://localhost/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address: "rai1abc123def456ghi789jkl012mno345pqrs6789" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nonce).toBeDefined();
    expect(body.sessionId).toBeDefined();
    expect(body.nonce).toHaveLength(64); // 32 bytes hex
    expect(body.sessionId).toHaveLength(64);
  });

  it("returns 400 for invalid address", async () => {
    const { POST } = await import("@/app/api/auth/nonce/route");
    const req = new NextRequest("http://localhost/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address: "cosmos1invalid" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid address");
  });

  it("returns 400 for missing address", async () => {
    const { POST } = await import("@/app/api/auth/nonce/route");
    const req = new NextRequest("http://localhost/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/auth/nonce/route");
    const req = new NextRequest("http://localhost/api/auth/nonce", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });
});

describe("POST /api/auth/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for missing fields", async () => {
    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address: "rai1x" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("returns 401 for expired/invalid session", async () => {
    mockSessionFindFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        address: "rai1x",
        pubKey: "base64key",
        signature: "base64sig",
        sessionId: "invalid-session",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid or expired nonce");
  });

  it("returns 401 for address mismatch", async () => {
    mockSessionFindFirst.mockResolvedValue({
      id: "sess-1",
      nonce: "testnonce",
      user: { id: "user-1", address: "rai1different" },
    });

    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        address: "rai1abc",
        pubKey: "base64key",
        signature: "base64sig",
        sessionId: "sess-id",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Address mismatch");
  });

  it("returns 401 for invalid signature", async () => {
    const { verifySignatureWithDiag } = await import("@/lib/signature");
    vi.mocked(verifySignatureWithDiag).mockResolvedValue({
      valid: false,
      debug: {
        pubkeyLength: 33,
        sigLength: 64,
        claimedAddress: "rai1abc",
        ethermintAddress: null,
        cosmosAddress: null,
        addressMatch: "none",
        eip191Result: "skipped",
        adr036Result: "skipped",
      },
    });

    mockSessionFindFirst.mockResolvedValue({
      id: "sess-1",
      nonce: "testnonce",
      user: { id: "user-1", address: "rai1abc" },
    });

    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        address: "rai1abc",
        pubKey: "base64key",
        signature: "base64sig",
        sessionId: "sess-id",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Signature failed");
  });

  it("creates session and sets cookie on valid signature", async () => {
    const { verifySignatureWithDiag } = await import("@/lib/signature");
    vi.mocked(verifySignatureWithDiag).mockResolvedValue({
      valid: true,
      debug: {
        pubkeyLength: 33,
        sigLength: 64,
        claimedAddress: "rai1abc",
        ethermintAddress: "rai1abc",
        cosmosAddress: null,
        addressMatch: "ethermint",
        eip191Result: true,
        adr036Result: "skipped",
      },
    });

    mockSessionFindFirst.mockResolvedValue({
      id: "sess-1",
      userId: "user-1",
      nonce: "testnonce",
      user: { id: "user-1", address: "rai1abc" },
    });

    mockTransaction.mockResolvedValue([{}, { id: "new-sess" }]);
    mockWorkspaceFindFirst.mockResolvedValue({ id: "ws-1", slug: "republic", isActive: true });
    mockMemberUpsert.mockResolvedValue({ role: "viewer" });

    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        address: "rai1abc",
        pubKey: "base64key",
        signature: "base64sig",
        sessionId: "sess-id",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.address).toBe("rai1abc");
    expect(body.role).toBe("viewer");

    // Check cookie was set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("panoptes_session=");
    expect(setCookie).toContain("HttpOnly");
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears session and cookie", async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: "panoptes_session=some-token" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockSessionDeleteMany).toHaveBeenCalled();
  });

  it("succeeds even without cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user info for authenticated request", async () => {
    const { resolveAuth } = await import("@/lib/auth");
    vi.mocked(resolveAuth).mockResolvedValue({
      user: { id: "user-1", address: "rai1abc" },
      workspace: { id: "ws-1", name: "Test", slug: "republic" },
      role: "member",
    });

    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://localhost/api/auth/me", {
      headers: { cookie: "panoptes_session=some-token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.address).toBe("rai1abc");
    expect(body.role).toBe("member");
  });

  it("returns anonymous for unauthenticated request", async () => {
    const { resolveAuth } = await import("@/lib/auth");
    vi.mocked(resolveAuth).mockResolvedValue({
      user: null,
      workspace: { id: "ws-1", name: "Test", slug: "republic" },
      role: "anonymous",
    });

    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://localhost/api/auth/me");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user).toBeNull();
    expect(body.role).toBe("anonymous");
  });
});
