import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, redactForRole, rateLimitForRole } from "@/lib/auth";

const KEY_REDACTIONS = [
  { field: "keyPrefix" as const, minRole: "member" as const, mask: "pk_***" },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "viewer", rl.headers);
  if (error) return error;

  const { id } = await params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      tier: true,
      isActive: true,
      rateLimit: true,
      dailyQuota: true,
      monthlyQuota: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not found" },
      { status: 404, headers: rl.headers },
    );
  }

  return NextResponse.json({ key: redactForRole(apiKey, auth!.role, KEY_REDACTIONS) }, { headers: rl.headers });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const writeError = requireRole(auth, "admin", rl.headers);
  if (writeError) return writeError;

  const { id } = await params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not found" },
      { status: 404, headers: rl.headers },
    );
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(
    { message: "API key deactivated" },
    { headers: rl.headers },
  );
}
