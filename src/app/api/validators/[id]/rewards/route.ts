import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import { isValidValoperAddress } from "@/lib/validation";
import type { YaciValidatorReward } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { id } = await params;
  if (!isValidValoperAddress(id)) {
    return jsonResponse({ error: "Invalid validator address" }, rl.headers, 400);
  }
  const encoded = encodeURIComponent(id);

  const result = await fetchYaci<YaciValidatorReward[]>(
    `/validator_rewards?validator_address=eq.${encoded}&order=height.desc&limit=100`,
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Reward data temporarily unavailable" },
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
