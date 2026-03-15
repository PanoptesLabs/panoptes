import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { API_KEY_DEFAULTS, API_KEY_TIERS, type ApiKeyTier } from "@/lib/constants";

export interface ApiKeyContext {
  id: string;
  workspaceId: string;
  tier: ApiKeyTier;
  rateLimit: number;
  workspace: { id: string; name: string; slug: string };
}

/**
 * Generate a new API key with pk_ prefix.
 */
export function generateApiKey(): string {
  return `${API_KEY_DEFAULTS.KEY_PREFIX}${randomBytes(32).toString("hex")}`;
}

/**
 * Hash an API key using SHA-256 (same approach as workspace tokens).
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Get the display prefix for an API key (first 12 chars).
 */
export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 12);
}

/**
 * Authenticate a raw API key.
 * Returns key context if valid, null if not.
 */
export async function authenticateApiKey(
  rawKey: string,
): Promise<ApiKeyContext | null> {
  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
    },
  });

  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (!apiKey.workspace.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    id: apiKey.id,
    workspaceId: apiKey.workspaceId,
    tier: apiKey.tier as ApiKeyTier,
    rateLimit: apiKey.rateLimit,
    workspace: {
      id: apiKey.workspace.id,
      name: apiKey.workspace.name,
      slug: apiKey.workspace.slug,
    },
  };
}

/**
 * Atomically increment usage counter and check quota.
 * Returns true if within quota, false if exceeded.
 */
export async function incrementAndCheckQuota(
  apiKeyId: string,
  period: string,
  periodType: "daily" | "monthly",
  quota: number,
): Promise<boolean> {
  if (quota === 0) return true; // 0 = unlimited

  const result = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiKeyUsageCounter" ("id", "apiKeyId", "period", "periodType", "count", "updatedAt")
    VALUES (gen_random_uuid(), ${apiKeyId}, ${period}, ${periodType}, 1, NOW())
    ON CONFLICT ("apiKeyId", "period", "periodType")
    DO UPDATE SET "count" = "ApiKeyUsageCounter"."count" + 1, "updatedAt" = NOW()
    WHERE "ApiKeyUsageCounter"."count" < ${quota}
    RETURNING "count"`;

  return result.length > 0;
}

/**
 * Check both daily and monthly quotas for an API key.
 */
export async function checkQuotas(
  apiKeyId: string,
  tier: ApiKeyTier,
): Promise<{ allowed: boolean; reason?: string }> {
  const tierConfig = API_KEY_TIERS[tier];
  const now = new Date();
  const dailyPeriod = now.toISOString().slice(0, 10); // "2026-03-15"
  const monthlyPeriod = now.toISOString().slice(0, 7); // "2026-03"

  const dailyOk = await incrementAndCheckQuota(
    apiKeyId,
    dailyPeriod,
    "daily",
    tierConfig.dailyQuota,
  );
  if (!dailyOk) {
    return { allowed: false, reason: "Daily quota exceeded" };
  }

  if (tierConfig.monthlyQuota > 0) {
    const monthlyOk = await incrementAndCheckQuota(
      apiKeyId,
      monthlyPeriod,
      "monthly",
      tierConfig.monthlyQuota,
    );
    if (!monthlyOk) {
      return { allowed: false, reason: "Monthly quota exceeded" };
    }
  }

  return { allowed: true };
}

/**
 * Get usage stats for an API key.
 */
export async function getApiKeyUsage(apiKeyId: string): Promise<{
  daily: { period: string; count: number }[];
  monthly: { period: string; count: number }[];
}> {
  const counters = await prisma.apiKeyUsageCounter.findMany({
    where: { apiKeyId },
    orderBy: { period: "desc" },
    take: 60,
  });

  return {
    daily: counters
      .filter((c) => c.periodType === "daily")
      .map((c) => ({ period: c.period, count: c.count })),
    monthly: counters
      .filter((c) => c.periodType === "monthly")
      .map((c) => ({ period: c.period, count: c.count })),
  };
}
