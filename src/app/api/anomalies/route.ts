import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseStringParam, parseBoolParam } from "@/lib/validation";
import { ANOMALY_TYPES, ANOMALY_SEVERITIES } from "@/lib/constants";
import type { AnomalyItem } from "@/types";

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatAnomaly(anomaly: {
  id: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string | null;
  title: string;
  description: string;
  metadata: string | null;
  resolved: boolean;
  detectedAt: Date;
  resolvedAt: Date | null;
}): AnomalyItem {
  return {
    id: anomaly.id,
    type: anomaly.type as AnomalyItem["type"],
    severity: anomaly.severity as AnomalyItem["severity"],
    entityType: anomaly.entityType as AnomalyItem["entityType"],
    entityId: anomaly.entityId,
    title: anomaly.title,
    description: anomaly.description,
    metadata: parseMetadata(anomaly.metadata),
    resolved: anomaly.resolved,
    detectedAt: anomaly.detectedAt.toISOString(),
    resolvedAt: anomaly.resolvedAt?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const searchParams = request.nextUrl.searchParams;
  const type = parseStringParam(searchParams.get("type"), [...ANOMALY_TYPES]);
  const severity = parseStringParam(searchParams.get("severity"), [...ANOMALY_SEVERITIES]);
  const resolved = parseBoolParam(searchParams.get("resolved"));
  const limit = parseIntParam(searchParams.get("limit"), 50, 1, 200);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);

  const entityType = searchParams.get("entityType") || undefined;
  const entityId = searchParams.get("entityId") || undefined;

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (resolved !== undefined) where.resolved = resolved;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const [anomalies, total] = await Promise.all([
    prisma.anomaly.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.anomaly.count({ where }),
  ]);

  return jsonResponse(
    {
      anomalies: anomalies.map(formatAnomaly),
      total,
      limit,
      offset,
    },
    rl.headers,
  );
}
