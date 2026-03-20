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

  const policy = await prisma.policy.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    select: { id: true, name: true },
  });

  if (!policy) {
    return NextResponse.json(
      { error: "Policy not found" },
      { status: 404, headers: rl.headers },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.policy.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog(auth!, "policy.disabled", "Policy", id, {
      policyName: policy.name,
    }, tx);
  });

  return NextResponse.json(
    { success: true },
    { headers: rl.headers },
  );
}
