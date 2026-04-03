import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { validatePreflight } from "@/lib/intelligence/preflight";
import { addressToBytes } from "republic-sdk";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body" },
      rl.headers,
      400,
      { cache: false },
    );
  }

  const { from, to, amount, denom, validatorAddress } = body as {
    from?: string;
    to?: string;
    amount?: string;
    denom?: string;
    validatorAddress?: string;
  };

  if (!from || !to || !amount) {
    return jsonResponse(
      { error: "Missing required fields: from, to, amount" },
      rl.headers,
      400,
      { cache: false },
    );
  }

  // Validate amount is a valid non-negative integer string (BigInt-compatible)
  if (!/^\d+$/.test(amount) || amount === "0") {
    return jsonResponse(
      { error: "Invalid amount: must be a positive integer string" },
      rl.headers,
      400,
      { cache: false },
    );
  }

  // Validate address format (bech32 checksum verification)
  for (const [label, addr] of [["from", from], ["to", to]] as const) {
    if (!addr.startsWith("rai1")) {
      return jsonResponse(
        { error: `Invalid ${label} address: must start with 'rai1'` },
        rl.headers,
        400,
        { cache: false },
      );
    }
    try {
      addressToBytes(addr);
    } catch {
      return jsonResponse(
        { error: `Invalid ${label} address: bech32 checksum verification failed` },
        rl.headers,
        400,
        { cache: false },
      );
    }
  }

  // Validate denom if provided
  if (denom && !/^[a-zA-Z][a-zA-Z0-9/]{0,127}$/.test(denom)) {
    return jsonResponse(
      { error: "Invalid denom format" },
      rl.headers,
      400,
      { cache: false },
    );
  }

  const result = await validatePreflight({
    from,
    to,
    amount,
    denom,
    validatorAddress,
  });

  return jsonResponse(result, rl.headers, 200, { cache: false });
}
