import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { extractApiKey } from "@/lib/workspace-auth";
import { authenticateApiKey, checkQuotas } from "@/lib/api-key";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { createStreamToken } from "@/lib/stream-token";
import { STREAM_DEFAULTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  // Session auth: require at least viewer role (blocks anonymous)
  const authError = requireRole(auth, "viewer", rl.headers);

  let workspace = authError ? null : auth!.workspace;

  // Fall back to x-api-key header only if session auth failed
  if (!workspace) {
    const rawKey = extractApiKey(request);
    if (rawKey) {
      const keyCtx = await authenticateApiKey(rawKey);
      if (keyCtx) {
        const keyRl = checkKeyRateLimit(keyCtx.id, keyCtx.rateLimit);
        if (!keyRl.allowed) {
          return NextResponse.json(
            { error: "API key rate limit exceeded" },
            { status: 429, headers: rl.headers },
          );
        }
        const quota = await checkQuotas(keyCtx.id, keyCtx.tier);
        if (!quota.allowed) {
          return NextResponse.json(
            { error: "Quota exceeded" },
            { status: 429, headers: rl.headers },
          );
        }
        workspace = keyCtx.workspace;
      }
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
