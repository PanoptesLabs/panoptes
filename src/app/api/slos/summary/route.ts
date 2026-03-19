import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await resolveAuth(request);
  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const slos = await prisma.slo.findMany({
    where: { workspaceId: auth!.workspace.id },
    orderBy: { createdAt: "desc" },
  });

  const total = slos.length;
  const active = slos.filter((s) => s.isActive).length;
  const breaching = slos.filter((s) => s.isActive && s.isBreaching).length;
  const budgetExhausted = slos.filter(
    (s) => s.isActive && (s.budgetConsumed ?? 0) >= 1.0,
  ).length;
  const healthyPct =
    active > 0
      ? ((active - breaching) / active) * 100
      : 100;

  return NextResponse.json(
    {
      total,
      active,
      breaching,
      budgetExhausted,
      healthyPct: Math.round(healthyPct * 100) / 100,
      slos,
    },
    { headers: rl.headers },
  );
}
