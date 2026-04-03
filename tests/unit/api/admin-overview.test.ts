import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: { count: vi.fn() },
    workspaceMember: { count: vi.fn(), groupBy: vi.fn() },
    webhook: { count: vi.fn() },
    slo: { count: vi.fn() },
    incident: { count: vi.fn() },
    policy: { count: vi.fn() },
    apiKey: { count: vi.fn() },
    webhookDelivery: { groupBy: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "120" } })),
}));

vi.mock("@/lib/auth", () => ({
  resolveAuth: vi.fn(),
  requireRole: vi.fn(),
  rateLimitForRole: vi.fn(() => 120),
}));

vi.mock("@/lib/time", () => ({
  hoursAgo: vi.fn(() => new Date(Date.now() - 24 * 60 * 60 * 1000)),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/db";
import { resolveAuth, requireRole } from "@/lib/auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

function authSuccess(role = "admin") {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: { id: "user-1", address: "rai1admin" },
    workspace: mockWorkspace,
    role: role as "admin" | "editor" | "member" | "viewer" | "anonymous",
  });
  vi.mocked(requireRole).mockReturnValue(null);
}

function authAnonymous() {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: null,
    workspace: mockWorkspace,
    role: "anonymous",
  });
  vi.mocked(requireRole).mockReturnValue(
    NextResponse.json({ error: "Authentication required" }, { status: 401 }),
  );
}

function authNonAdmin(role: string) {
  vi.mocked(resolveAuth).mockResolvedValue({
    user: { id: "user-2", address: "rai1viewer" },
    workspace: mockWorkspace,
    role: role as "viewer" | "member" | "editor",
  });
  vi.mocked(requireRole).mockReturnValue(
    NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
  );
}

// Pre-load route module outside test body to avoid timeout from module resolution
let GET: (req: NextRequest) => Promise<Response>;

describe("GET /api/admin/overview", () => {
  beforeAll(async () => {
    const mod = await import("@/app/api/admin/overview/route");
    GET = mod.GET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overview stats for admin", async () => {
    authSuccess();
    vi.mocked(prisma.workspaceMember.count).mockResolvedValue(5);
    vi.mocked(prisma.userSession.count).mockResolvedValue(3);
    vi.mocked(prisma.workspaceMember.groupBy).mockResolvedValue([
      { role: "admin", _count: 1 },
      { role: "viewer", _count: 4 },
    ] as never);
    vi.mocked(prisma.webhook.count).mockResolvedValue(2);
    vi.mocked(prisma.slo.count).mockResolvedValue(5);
    vi.mocked(prisma.incident.count).mockResolvedValue(1);
    vi.mocked(prisma.policy.count).mockResolvedValue(3);
    vi.mocked(prisma.apiKey.count).mockResolvedValue(4);
    vi.mocked(prisma.webhookDelivery.groupBy).mockResolvedValue([
      { success: true, _count: 45 },
      { success: false, _count: 2 },
    ] as never);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/admin/overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.users.total).toBe(5);
    expect(body.sessions.active).toBe(3);
    expect(body.members.admin).toBe(1);
    expect(body.members.viewer).toBe(4);
    expect(body.resources.webhooks).toBe(2);
    expect(body.deliveries24h.success).toBe(45);
    expect(body.deliveries24h.failed).toBe(2);
  });

  it("returns 401 for anonymous", async () => {
    authAnonymous();

    const req = new NextRequest("http://localhost/api/admin/overview");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin roles", async () => {
    authNonAdmin("viewer");

    const req = new NextRequest("http://localhost/api/admin/overview");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns 500 when database throws", async () => {
    authSuccess();
    vi.mocked(prisma.workspaceMember.count).mockRejectedValue(new Error("DB connection lost"));

    const req = new NextRequest("http://localhost/api/admin/overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});
