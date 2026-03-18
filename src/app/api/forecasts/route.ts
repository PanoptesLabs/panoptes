import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { getForecasts } from "@/lib/intelligence";
import { parseIntParam, parseStringParam } from "@/lib/validation";
import { FORECAST_DEFAULTS } from "@/lib/constants";

const METRIC_VALUES = [...FORECAST_DEFAULTS.METRICS] as string[];

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const searchParams = request.nextUrl.searchParams;
  const entityType = searchParams.get("entityType") || undefined;
  const entityId = searchParams.get("entityId") || undefined;
  const metric = parseStringParam(searchParams.get("metric"), METRIC_VALUES);
  const limit = parseIntParam(
    searchParams.get("limit"),
    FORECAST_DEFAULTS.DEFAULT_LIMIT,
    1,
    FORECAST_DEFAULTS.MAX_LIMIT,
  );
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);

  const result = await getForecasts({ entityType, entityId, metric, limit, offset });

  return jsonResponse(
    {
      forecasts: result.forecasts.map((f) => ({
        ...f,
        validUntil: f.validUntil.toISOString(),
        createdAt: f.createdAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    },
    rl.headers,
  );
}
