"use client";

import useSWR from "swr";
import { sessionSwrConfig } from "./use-api";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  tier: string;
  isActive: boolean;
  rateLimit: number;
  dailyQuota: number;
  monthlyQuota: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ApiKeysResponse {
  keys: ApiKeyItem[];
}

interface ApiKeyUsageResponse {
  keyId: string;
  dailyQuota: number;
  monthlyQuota: number;
  usage: {
    daily: { period: string; count: number }[];
    monthly: { period: string; count: number }[];
  };
}

export function useApiKeys() {
  return useSWR<ApiKeysResponse>(
    "/api/keys",
    sessionSwrConfig,
  );
}

export function useApiKeyUsage(keyId: string | null) {
  return useSWR<ApiKeyUsageResponse>(
    keyId ? `/api/keys/${keyId}/usage` : null,
    sessionSwrConfig,
  );
}
