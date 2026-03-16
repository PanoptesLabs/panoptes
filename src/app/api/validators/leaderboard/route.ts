import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam } from "@/lib/validation";
import { LEADERBOARD_DEFAULTS } from "@/lib/constants";
import { getLeaderboard, VALID_CATEGORIES } from "@/lib/intelligence/leaderboard";
import type { LeaderboardCategory } from "@/lib/intelligence/leaderboard";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;

  const category = params.get("category") ?? "overall";
  if (!VALID_CATEGORIES.includes(category as LeaderboardCategory)) {
    return jsonResponse(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      rl.headers,
      400,
    );
  }

  const limit = parseIntParam(
    params.get("limit"),
    LEADERBOARD_DEFAULTS.DEFAULT_LIMIT,
    1,
    LEADERBOARD_DEFAULTS.MAX_LIMIT,
  );

  const entries = await getLeaderboard(category as LeaderboardCategory, limit);

  return jsonResponse({ entries, category, limit }, rl.headers);
}
