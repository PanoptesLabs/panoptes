"use client";

import useSWR from "swr";
import { useWorkspace } from "./use-workspace";
import { workspaceSwrConfig } from "./use-api";

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
  const { token } = useWorkspace();
  return useSWR<ApiKeysResponse>(
    token ? "/api/keys" : null,
    workspaceSwrConfig(token),
  );
}

export function useApiKeyUsage(keyId: string | null) {
  const { token } = useWorkspace();
  return useSWR<ApiKeyUsageResponse>(
    token && keyId ? `/api/keys/${keyId}/usage` : null,
    workspaceSwrConfig(token),
  );
}
