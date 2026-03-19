"use client";

import useSWR from "swr";
import { sessionSwrConfig, sessionMutate } from "./use-api";
import type { PolicyItem, PolicyExecutionItem } from "@/types";

export function usePolicies() {
  return useSWR<{ policies: PolicyItem[] }>(
    "/api/policies",
    sessionSwrConfig,
  );
}

export function usePolicyDetail(id: string | null) {
  return useSWR<PolicyItem & { executions: PolicyExecutionItem[] }>(
    id ? `/api/policies/${id}` : null,
    sessionSwrConfig,
  );
}

export function usePolicyExecutions(
  id: string | null,
  opts?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/policies/${id}/executions${query ? `?${query}` : ""}`;

  return useSWR<{ executions: PolicyExecutionItem[]; total: number; limit: number; offset: number }>(
    id ? url : null,
    sessionSwrConfig,
  );
}

export function createPolicy(
  data: {
    name: string;
    description?: string;
    conditions: unknown[];
    actions: unknown[];
    dryRun?: boolean;
    priority?: number;
    cooldownMinutes?: number;
  },
) {
  return sessionMutate<PolicyItem>("/api/policies", "POST", data);
}

export function updatePolicy(
  id: string,
  data: Record<string, unknown>,
) {
  return sessionMutate<PolicyItem>(`/api/policies/${id}`, "PATCH", data);
}

export function deletePolicy(id: string) {
  return sessionMutate(`/api/policies/${id}`, "DELETE");
}

export function testPolicy(
  id: string,
  context?: Record<string, unknown>,
) {
  return sessionMutate<Record<string, unknown>>(`/api/policies/${id}/test`, "POST", context || {});
}
