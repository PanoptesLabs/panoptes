import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "admin", rl.headers);
  if (error) return error;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    userCount,
    activeSessions,
    membersByRole,
    webhookCount,
    sloCount,
    openIncidentCount,
    policyCount,
    apiKeyCount,
    deliveries24h,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.userSession.count({
      where: { expiresAt: { gt: now }, nonce: null },
    }),
    prisma.workspaceMember.groupBy({
      by: ["role"],
      _count: true,
      where: { workspaceId: auth!.workspace.id },
    }),
    prisma.webhook.count({ where: { workspaceId: auth!.workspace.id } }),
    prisma.slo.count({ where: { workspaceId: auth!.workspace.id } }),
    prisma.incident.count({
      where: { workspaceId: auth!.workspace.id, status: "open" },
    }),
    prisma.policy.count({ where: { workspaceId: auth!.workspace.id } }),
    prisma.apiKey.count({ where: { workspaceId: auth!.workspace.id } }),
    prisma.webhookDelivery.groupBy({
      by: ["success"],
      _count: true,
      where: { createdAt: { gt: twentyFourHoursAgo } },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: auth!.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        actorAddress: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  const roleMap: Record<string, number> = { admin: 0, editor: 0, member: 0, viewer: 0 };
  for (const row of membersByRole) {
    roleMap[row.role] = row._count;
  }

  const deliveryMap: Record<string, number> = { success: 0, failed: 0 };
  for (const row of deliveries24h) {
    if (row.success) deliveryMap.success = row._count;
    else deliveryMap.failed = row._count;
  }

  return NextResponse.json(
    {
      users: { total: userCount },
      sessions: { active: activeSessions },
      members: roleMap,
      resources: {
        webhooks: webhookCount,
        slos: sloCount,
        incidents: openIncidentCount,
        policies: policyCount,
        apiKeys: apiKeyCount,
      },
      deliveries24h: deliveryMap,
      recentAudit,
    },
    { headers: rl.headers },
  );
}
