import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam } from "@/lib/validation";
import { fetchYaci } from "@/lib/yaci";
import type { ComputeLeaderboardEntry } from "@/types";

// Yaci /compute_leaderboard returns a flat array
type YaciLeaderboardResponse = ComputeLeaderboardEntry[];

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const limit = parseIntParam(
    request.nextUrl.searchParams.get("limit"),
    100,
    1,
    200,
  );

  const result = await fetchYaci<YaciLeaderboardResponse>(
    `/compute_leaderboard?limit=${limit}`,
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Compute leaderboard temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  return jsonResponse({ entries: result.data }, rl.headers, 200, {
    sMaxAge: 120,
    staleWhileRevalidate: 240,
  });
}
