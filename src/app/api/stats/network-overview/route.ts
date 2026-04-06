import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciNetworkOverview } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciNetworkOverview[]>("/mv_network_overview");

  if (!result.ok) {
    return jsonResponse(
      { error: "Network overview temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const overview = result.data[0] ?? null;

  return jsonResponse(overview, rl.headers, 200, {
    sMaxAge: 30,
    staleWhileRevalidate: 60,
  });
}
