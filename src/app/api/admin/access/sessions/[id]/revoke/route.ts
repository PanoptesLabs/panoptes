import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "admin", rl.headers);
  if (error) return error;

  const { id } = await params;

  // Find session and verify the user belongs to this workspace
  const session = await prisma.userSession.findFirst({
    where: { id },
    include: {
      user: {
        include: {
          members: {
            where: { workspaceId: auth!.workspace.id },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!session || session.user.members.length === 0) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404, headers: rl.headers },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSession.delete({ where: { id } });

    await createAuditLog(auth!, "session.revoked", "UserSession", id, {
      targetUserId: session.userId,
    }, tx);
  });

  return NextResponse.json(
    { success: true },
    { headers: rl.headers },
  );
}
