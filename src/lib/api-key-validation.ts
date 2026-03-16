import { API_KEY_DEFAULTS, API_KEY_TIERS, type ApiKeyTier } from "@/lib/constants";

interface ValidatedApiKeyCreate {
  name: string;
  tier: ApiKeyTier;
  expiresAt: Date | null;
}

export function validateApiKeyCreate(
  body: unknown,
): ValidatedApiKeyCreate | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body" };
  }

  const { name, tier, expiresAt } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < API_KEY_DEFAULTS.NAME_MIN_LENGTH) {
    return { error: `Name must be at least ${API_KEY_DEFAULTS.NAME_MIN_LENGTH} character` };
  }

  if (name.trim().length > API_KEY_DEFAULTS.NAME_MAX_LENGTH) {
    return { error: `Name must be at most ${API_KEY_DEFAULTS.NAME_MAX_LENGTH} characters` };
  }

  const validTier = (tier as string) || "free";
  if (!Object.keys(API_KEY_TIERS).includes(validTier)) {
    return { error: `Invalid tier. Must be one of: ${Object.keys(API_KEY_TIERS).join(", ")}` };
  }

  let parsedExpiry: Date | null = null;
  if (expiresAt !== undefined && expiresAt !== null) {
    parsedExpiry = new Date(expiresAt as string);
    if (isNaN(parsedExpiry.getTime())) {
      return { error: "Invalid expiresAt date" };
    }
    if (parsedExpiry <= new Date()) {
      return { error: "expiresAt must be in the future" };
    }
  }

  return {
    name: name.trim(),
    tier: validTier as ApiKeyTier,
    expiresAt: parsedExpiry,
  };
}
