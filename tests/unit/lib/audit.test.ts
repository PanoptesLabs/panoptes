import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import type { AuthContext } from "@/lib/auth";

describe("createAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuth: AuthContext = {
    user: { id: "user-1", address: "rai1abc123" },
    workspace: { id: "ws-1", name: "Test", slug: "test" },
    role: "admin",
  };

  it("creates audit log with correct fields including workspaceId", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { createAuditLog } = await import("@/lib/audit");
    await createAuditLog(mockAuth, "member.role_changed", "WorkspaceMember", "m-1", {
      previousRole: "viewer",
      newRole: "admin",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        actorUserId: "user-1",
        actorAddress: "rai1abc123",
        action: "member.role_changed",
        resourceType: "WorkspaceMember",
        resourceId: "m-1",
        metadata: JSON.stringify({ previousRole: "viewer", newRole: "admin" }),
      },
    });
  });

  it("handles null metadata", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { createAuditLog } = await import("@/lib/audit");
    await createAuditLog(mockAuth, "session.revoked", "UserSession");

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        resourceId: null,
        metadata: null,
      }),
    });
  });

  it("skips when auth.user is null", async () => {
    const anonAuth: AuthContext = {
      user: null,
      workspace: { id: "ws-1", name: "Test", slug: "test" },
      role: "anonymous",
    };

    const { createAuditLog } = await import("@/lib/audit");
    await createAuditLog(anonAuth, "test.action", "Test");

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("uses transaction client when provided", async () => {
    const txCreate = vi.fn().mockResolvedValue({});
    const tx = { auditLog: { create: txCreate } };

    const { createAuditLog } = await import("@/lib/audit");
    await createAuditLog(mockAuth, "api_key.disabled", "ApiKey", "key-123", undefined, tx);

    // Should use tx, not prisma
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        resourceId: "key-123",
      }),
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("serializes metadata to JSON string", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const { createAuditLog } = await import("@/lib/audit");
    await createAuditLog(mockAuth, "webhook.disabled", "Webhook", "wh-1", {
      webhookName: "My Hook",
      nested: { key: "value" },
    });

    const callArg = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
    const parsed = JSON.parse(callArg.data.metadata as string);
    expect(parsed.webhookName).toBe("My Hook");
    expect(parsed.nested.key).toBe("value");
  });
});
