import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciFeeRevenue } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciFeeRevenue[]>("/fee_revenue");

  if (!result.ok) {
    return jsonResponse(
      { error: "Fee revenue data temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const revenue = result.data[0] ?? null;

  return jsonResponse(revenue, rl.headers, 200, {
    sMaxAge: 120,
    staleWhileRevalidate: 240,
  });
}
