import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const VALID_ROLES = ["viewer", "member", "editor", "admin"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "admin", rl.headers);
  if (error) return error;

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400, headers: rl.headers },
    );
  }

  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    include: { user: { select: { id: true, address: true } } },
  });

  if (!member) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404, headers: rl.headers },
    );
  }

  // Self-demotion guard
  if (member.userId === auth!.user!.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400, headers: rl.headers },
    );
  }

  const previousRole = member.role;

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.update({
      where: { id },
      data: { role: body.role },
    });

    await createAuditLog(auth!, "member.role_changed", "WorkspaceMember", id, {
      previousRole,
      newRole: body.role,
      targetAddress: member.user.address,
    }, tx);
  });

  return NextResponse.json(
    { success: true, previousRole, newRole: body.role },
    { headers: rl.headers },
  );
}
