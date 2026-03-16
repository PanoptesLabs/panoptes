import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { getForecasts } from "@/lib/intelligence";
import { parseIntParam } from "@/lib/validation";
import { FORECAST_DEFAULTS } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { entityType, entityId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseIntParam(
    searchParams.get("limit"),
    FORECAST_DEFAULTS.DEFAULT_LIMIT,
    1,
    FORECAST_DEFAULTS.MAX_LIMIT,
  );

  const result = await getForecasts({ entityType, entityId, limit });

  return jsonResponse(
    {
      forecasts: result.forecasts.map((f) => ({
        ...f,
        validUntil: f.validUntil.toISOString(),
        createdAt: f.createdAt.toISOString(),
      })),
      total: result.total,
      limit,
    },
    rl.headers,
  );
}
