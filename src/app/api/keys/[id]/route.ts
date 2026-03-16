import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request, rl.headers);
  if (auth.error) return auth.error;

  const { id } = await params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, workspaceId: auth.workspace.id },
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

  return NextResponse.json({ key: apiKey }, { headers: rl.headers });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request, rl.headers);
  if (auth.error) return auth.error;

  const { id } = await params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, workspaceId: auth.workspace.id },
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
