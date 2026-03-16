import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { getApiKeyUsage } from "@/lib/api-key";

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
    select: { id: true, dailyQuota: true, monthlyQuota: true },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const usage = await getApiKeyUsage(id);

  return NextResponse.json(
    {
      keyId: id,
      dailyQuota: apiKey.dailyQuota,
      monthlyQuota: apiKey.monthlyQuota,
      usage,
    },
    { headers: rl.headers },
  );
}
