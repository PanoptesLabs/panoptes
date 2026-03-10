import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseStringParam } from "@/lib/validation";
import { selectBestEndpoint } from "@/lib/intelligence";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const type =
    parseStringParam(request.nextUrl.searchParams.get("type"), [
      "rpc",
      "rest",
      "evm-rpc",
    ]) ?? "rpc";

  const result = await selectBestEndpoint(type);

  return jsonResponse(
    {
      endpoint: result.endpoint,
      alternatives: result.alternatives,
      strategy: result.strategy,
    },
    rl.headers,
  );
}
