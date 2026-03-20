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

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
  const action = url.searchParams.get("action") ?? undefined;
  const resourceType = url.searchParams.get("resourceType") ?? undefined;

  const where: Record<string, unknown> = { workspaceId: auth!.workspace.id };
  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
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
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json(
    { logs, total, limit, offset },
    { headers: rl.headers },
  );
}
