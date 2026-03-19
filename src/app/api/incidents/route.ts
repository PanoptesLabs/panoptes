import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole } from "@/lib/auth";
import { parseIntParam, parseStringParam } from "@/lib/validation";
import { INCIDENT_STATUSES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await resolveAuth(request);
  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const limit = parseIntParam(searchParams.get("limit"), 50, 1, 200);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);
  const status = parseStringParam(searchParams.get("status"), [...INCIDENT_STATUSES]);
  const severity = parseStringParam(searchParams.get("severity"), ["critical", "high", "medium", "low"]);
  const entityType = parseStringParam(searchParams.get("entityType"), ["endpoint", "validator"]);

  const where: Record<string, unknown> = {
    workspaceId: auth!.workspace.id,
  };
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (entityType) where.entityType = entityType;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return NextResponse.json(
    { incidents, total, limit, offset },
    { headers: rl.headers },
  );
}
