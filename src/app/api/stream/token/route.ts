import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth } from "@/lib/auth";
import { extractApiKey } from "@/lib/workspace-auth";
import { authenticateApiKey } from "@/lib/api-key";
import { createStreamToken } from "@/lib/stream-token";
import { STREAM_DEFAULTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  // Try session auth first, then fall back to x-api-key header
  const auth = await resolveAuth(request);
  let workspace = auth?.workspace ?? null;

  if (!workspace) {
    const rawKey = extractApiKey(request);
    if (rawKey) {
      const keyCtx = await authenticateApiKey(rawKey);
      if (keyCtx) workspace = keyCtx.workspace;
    }
  }

  if (!workspace) {
    return NextResponse.json(
      { error: "Unauthorized — valid session or API key required" },
      { status: 401, headers: rl.headers },
    );
  }

  const token = createStreamToken(
    workspace.id,
    STREAM_DEFAULTS.TOKEN_TTL_SECONDS,
  );

  return NextResponse.json(
    { token, expiresIn: STREAM_DEFAULTS.TOKEN_TTL_SECONDS },
    { headers: rl.headers },
  );
}
