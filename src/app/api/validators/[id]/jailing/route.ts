import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci } from "@/lib/yaci";
import { isValidValoperAddress } from "@/lib/validation";
import type { YaciJailingEvent } from "@/types";

interface YaciValidator {
  operator_address: string;
  consensus_address: string;
}

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

  // Jailing events use validator_address (consensus format, e.g. raivalcons1...).
  // We receive an operator address (raivaloper1...), so first resolve the consensus address.
  const validatorResult = await fetchYaci<YaciValidator[]>(
    `/validators?operator_address=eq.${encoded}&select=operator_address,consensus_address&limit=1`,
  );

  if (!validatorResult.ok) {
    return jsonResponse(
      { error: "Jailing data temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const validator = validatorResult.data[0];
  if (!validator?.consensus_address) {
    // No consensus address found — return empty (not an error)
    return jsonResponse([], rl.headers, 200, {
      sMaxAge: 60,
      staleWhileRevalidate: 120,
    });
  }

  const consensusEncoded = encodeURIComponent(validator.consensus_address);
  const result = await fetchYaci<YaciJailingEvent[]>(
    `/jailing_events?validator_address=eq.${consensusEncoded}&order=height.desc&limit=50`,
  );

  if (!result.ok) {
    return jsonResponse(
      { error: "Jailing data temporarily unavailable" },
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
