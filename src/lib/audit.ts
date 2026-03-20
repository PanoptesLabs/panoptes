import { prisma } from "@/lib/db";
import type { AuthContext } from "@/lib/auth";

type AuditClient = { auditLog: { create: typeof prisma.auditLog.create } };

export async function createAuditLog(
  auth: AuthContext,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
  tx?: AuditClient,
): Promise<void> {
  if (!auth.user) return;
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      workspaceId: auth.workspace.id,
      actorUserId: auth.user.id,
      actorAddress: auth.user.address,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
