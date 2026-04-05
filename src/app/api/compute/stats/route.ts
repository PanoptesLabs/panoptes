import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { ComputeStats } from "@/types";

// Yaci /compute_stats returns an array with a single element
type YaciStatsResponse = ComputeStats[];

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciStatsResponse>("/compute_stats");

  if (!result.ok) {
    return jsonResponse(
      { error: "Compute stats temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const stats = result.data[0] ?? null;

  return jsonResponse(stats, rl.headers, 200, {
    sMaxAge: 30,
    staleWhileRevalidate: 60,
  });
}
