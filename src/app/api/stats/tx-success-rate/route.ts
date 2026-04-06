import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciTxSuccessRate } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciTxSuccessRate[]>("/tx_success_rate");

  if (!result.ok) {
    return jsonResponse(
      { error: "Success rate data temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const stats = result.data[0] ?? null;

  return jsonResponse(stats, rl.headers, 200, {
    sMaxAge: 60,
    staleWhileRevalidate: 120,
  });
}
