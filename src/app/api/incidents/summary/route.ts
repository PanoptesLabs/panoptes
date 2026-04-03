import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";

interface MttrRow {
  mtta_minutes: number | null;
  mttr_minutes: number | null;
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const workspaceId = auth!.workspace.id;

  const incidents = await prisma.incident.findMany({
    where: { workspaceId },
    select: { status: true, severity: true },
  });

  const total = incidents.length;
  const open = incidents.filter((i) => i.status === "open").length;
  const acknowledged = incidents.filter((i) => i.status === "acknowledged").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const critical = incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length;

  // MTTA: average time from detectedAt to acknowledgedAt (for incidents that were acknowledged)
  // MTTR: average time from detectedAt to resolvedAt (for resolved incidents)
  const mttrRows: MttrRow[] = await prisma.$queryRaw`
    SELECT
      AVG(EXTRACT(EPOCH FROM ("acknowledgedAt" - "detectedAt")) / 60)
        FILTER (WHERE "acknowledgedAt" IS NOT NULL) AS mtta_minutes,
      AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "detectedAt")) / 60)
        FILTER (WHERE "resolvedAt" IS NOT NULL) AS mttr_minutes
    FROM "Incident"
    WHERE "workspaceId" = ${workspaceId}
  `;

  const mttaMinutes = mttrRows[0]?.mtta_minutes !== null
    ? Math.round(mttrRows[0].mtta_minutes)
    : null;
  const mttrMinutes = mttrRows[0]?.mttr_minutes !== null
    ? Math.round(mttrRows[0].mttr_minutes)
    : null;

  return NextResponse.json(
    { total, open, acknowledged, resolved, critical, mttaMinutes, mttrMinutes },
    { headers: rl.headers },
  );
}
