import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { safeParseJSON } from "@/lib/policy-validation";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  // Get whale movement anomalies (recent)
  const whales = await prisma.anomaly.findMany({
    where: { type: "whale_movement" },
    orderBy: { detectedAt: "desc" },
    take: 50,
    select: {
      id: true,
      severity: true,
      entityId: true,
      title: true,
      description: true,
      metadata: true,
      resolved: true,
      detectedAt: true,
      resolvedAt: true,
    },
  });

  const parsed = whales.map((w) => ({
    ...w,
    metadata: w.metadata ? safeParseJSON(w.metadata, null) : null,
  }));

  return jsonResponse({ whales: parsed, total: parsed.length }, rl.headers);
}
