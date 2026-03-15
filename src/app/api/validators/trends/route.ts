import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { LEADERBOARD_DEFAULTS } from "@/lib/constants";
import { getScoreTrend } from "@/lib/intelligence/leaderboard";

const VALID_PERIODS = LEADERBOARD_DEFAULTS.TREND_PERIODS as readonly string[];

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (!id || id.trim() === "") {
    return jsonResponse({ error: "id parameter is required" }, rl.headers, 400);
  }

  const period = params.get("period") ?? "30d";
  if (!VALID_PERIODS.includes(period)) {
    return jsonResponse(
      { error: `Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}` },
      rl.headers,
      400,
    );
  }

  const trend = await getScoreTrend(id, period);

  return jsonResponse({ validatorId: id, period, trend }, rl.headers);
}
