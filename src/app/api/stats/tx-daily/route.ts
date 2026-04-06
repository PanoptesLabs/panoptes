import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciDailyTxStats } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciDailyTxStats[]>(
    "/daily_tx_stats?order=date.desc&limit=30",
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Transaction stats temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  return jsonResponse(result.data, rl.headers, 200, {
    sMaxAge: 60,
    staleWhileRevalidate: 120,
  });
}
