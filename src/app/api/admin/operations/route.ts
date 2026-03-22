import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "admin", rl.headers);
  if (error) return error;

  try {
    const workspaceId = auth!.workspace.id;

    const [webhooks, policies, recentIncidents] = await Promise.all([
      prisma.webhook.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
          deliveries: {
            select: { success: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.policy.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          isActive: true,
          dryRun: true,
          lastTriggeredAt: true,
          createdAt: true,
          _count: { select: { executions: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incident.findMany({
        where: { workspaceId },
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          detectedAt: true,
          resolvedAt: true,
        },
        orderBy: { detectedAt: "desc" },
        take: 20,
      }),
    ]);

    const webhookList = webhooks.map((w) => {
      const total = w.deliveries.length;
      const successCount = w.deliveries.filter((d) => d.success).length;
      const lastDelivery = w.deliveries[0];
      return {
        id: w.id,
        name: w.name,
        isActive: w.isActive,
        totalDeliveries: total,
        successRate: total > 0 ? successCount / total : 1,
        lastDeliveryAt: lastDelivery?.createdAt ?? null,
      };
    });

    const policyList = policies.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      dryRun: p.dryRun,
      executionCount: p._count.executions,
      lastTriggeredAt: p.lastTriggeredAt,
    }));

    return NextResponse.json(
      {
        webhooks: webhookList,
        policies: policyList,
        recentIncidents,
      },
      { headers: rl.headers },
    );
  } catch (err) {
    logger.error("admin/operations", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: rl.headers },
    );
  }
}
