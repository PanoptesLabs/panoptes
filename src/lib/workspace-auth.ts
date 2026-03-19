import { NextRequest } from "next/server";
import { createHash } from "crypto";

/**
 * Hash a raw token using SHA-256.
 * Used for session tokens and API key lookups.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Extract API key from x-api-key header.
 * Used as fallback auth for SDK/external clients.
 */
export function extractApiKey(request: NextRequest): string | null {
  const key = request.headers.get("x-api-key");
  if (!key) return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}
