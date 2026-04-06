import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciBlockMetric } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciBlockMetric[]>(
    "/block_metrics?order=height.desc&limit=100",
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Block metrics temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  return jsonResponse(result.data, rl.headers, 200, {
    sMaxAge: 30,
    staleWhileRevalidate: 60,
  });
}
