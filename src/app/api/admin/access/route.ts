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
    const now = new Date();

    const [members, apiKeys] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId: auth!.workspace.id },
        include: {
          user: {
            select: {
              id: true,
              address: true,
              sessions: {
                select: {
                  id: true,
                  expiresAt: true,
                  createdAt: true,
                },
                where: { expiresAt: { gt: now }, nonce: null },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.apiKey.findMany({
        where: { workspaceId: auth!.workspace.id },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          tier: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const memberList = members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      address: m.user.address,
      role: m.role,
      activeSessions: m.user.sessions.length,
      sessions: m.user.sessions,
      joinedAt: m.createdAt,
    }));

    return NextResponse.json(
      { members: memberList, apiKeys },
      { headers: rl.headers },
    );
  } catch (err) {
    logger.error("admin/access", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: rl.headers },
    );
  }
}
