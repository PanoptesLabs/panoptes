import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import { isValidValoperAddress } from "@/lib/validation";
import type { YaciValidatorSigningStats } from "@/types";

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

  const result = await fetchYaci<YaciValidatorSigningStats[]>(
    `/mv_validator_signing_stats?operator_address=eq.${encoded}`,
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Signing stats temporarily unavailable" },
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
