import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import type { YaciMessageTypeStat } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const result = await fetchYaci<YaciMessageTypeStat[]>(
    "/message_type_stats?order=count.desc&limit=10",
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Message type stats temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  return jsonResponse(result.data, rl.headers, 200, {
    sMaxAge: 120,
    staleWhileRevalidate: 240,
  });
}
