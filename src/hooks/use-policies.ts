"use client";

import useSWR from "swr";
import { workspaceSwrConfig, workspaceMutate } from "./use-api";
import type { PolicyItem, PolicyExecutionItem } from "@/types";

export function usePolicies(token: string | null) {
  return useSWR<{ policies: PolicyItem[] }>(
    token ? "/api/policies" : null,
    workspaceSwrConfig(token),
  );
}

export function usePolicyDetail(token: string | null, id: string | null) {
  return useSWR<PolicyItem & { executions: PolicyExecutionItem[] }>(
    token && id ? `/api/policies/${id}` : null,
    workspaceSwrConfig(token),
  );
}

export function usePolicyExecutions(
  token: string | null,
  id: string | null,
  opts?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/policies/${id}/executions${query ? `?${query}` : ""}`;

  return useSWR<{ executions: PolicyExecutionItem[]; total: number; limit: number; offset: number }>(
    token && id ? url : null,
    workspaceSwrConfig(token),
  );
}

export function createPolicy(
  token: string,
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
  return workspaceMutate<PolicyItem>(token, "/api/policies", "POST", data);
}

export function updatePolicy(
  token: string,
  id: string,
  data: Record<string, unknown>,
) {
  return workspaceMutate<PolicyItem>(token, `/api/policies/${id}`, "PATCH", data);
}

export function deletePolicy(token: string, id: string) {
  return workspaceMutate(token, `/api/policies/${id}`, "DELETE");
}

export function testPolicy(
  token: string,
  id: string,
  context?: Record<string, unknown>,
) {
  return workspaceMutate<Record<string, unknown>>(token, `/api/policies/${id}/test`, "POST", context || {});
}
