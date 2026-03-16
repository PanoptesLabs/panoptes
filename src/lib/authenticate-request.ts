import { NextRequest } from "next/server";
import { authenticateWorkspace, extractApiKey, type WorkspaceContext } from "@/lib/workspace-auth";
import { authenticateApiKey, checkQuotas } from "@/lib/api-key";
import { type ApiKeyTier } from "@/lib/constants";

export interface AuthContext {
  workspace: WorkspaceContext;
  source: "bearer" | "api-key";
  apiKeyId?: string;
  tier?: ApiKeyTier;
}

/**
 * Unified authentication: tries Bearer token first, then x-api-key.
 * Returns null if neither auth method succeeds.
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthContext | null> {
  // 1. Bearer token → workspace auth (existing method)
  const ws = await authenticateWorkspace(request);
  if (ws) return { workspace: ws, source: "bearer" };

  // 2. x-api-key → API key auth
  const rawKey = extractApiKey(request);
  if (!rawKey) return null;

  const keyCtx = await authenticateApiKey(rawKey);
  if (!keyCtx) return null;

  // 3. Check quota
  const quota = await checkQuotas(keyCtx.id, keyCtx.tier);
  if (!quota.allowed) return null;

  return {
    workspace: keyCtx.workspace,
    source: "api-key",
    apiKeyId: keyCtx.id,
    tier: keyCtx.tier,
  };
}
