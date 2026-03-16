import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { LEADERBOARD_DEFAULTS } from "@/lib/constants";
import { compareValidators } from "@/lib/intelligence/leaderboard";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;
  const idsParam = params.get("ids");

  if (!idsParam || idsParam.trim() === "") {
    return jsonResponse({ error: "ids parameter is required" }, rl.headers, 400);
  }

  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

  if (ids.length === 0) {
    return jsonResponse({ error: "ids parameter is required" }, rl.headers, 400);
  }

  if (ids.length > LEADERBOARD_DEFAULTS.MAX_COMPARE) {
    return jsonResponse(
      { error: `Maximum ${LEADERBOARD_DEFAULTS.MAX_COMPARE} validators can be compared` },
      rl.headers,
      400,
    );
  }

  const results = await compareValidators(ids);

  const foundIds = new Set(results.map((r) => r.validatorId));
  const missingIds = ids.filter((id) => !foundIds.has(id));

  if (missingIds.length === ids.length) {
    return jsonResponse({ error: "No validators found" }, rl.headers, 404);
  }

  return jsonResponse(
    {
      results,
      ...(missingIds.length > 0 && { warning: `Not found: ${missingIds.join(", ")}` }),
    },
    rl.headers,
  );
}
