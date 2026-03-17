"use client";

import useSWR from "swr";
import { workspaceSwrConfig, workspaceMutate } from "./use-api";
import type { SloSummary, SloItem } from "@/types";

export function useSloSummary(token: string | null) {
  return useSWR<SloSummary>(
    token ? "/api/slos/summary" : null,
    workspaceSwrConfig(token),
  );
}

export function useSloDetail(token: string | null, id: string | null) {
  return useSWR<SloItem>(
    token && id ? `/api/slos/${id}` : null,
    workspaceSwrConfig(token),
  );
}

export function useSloEvaluations(token: string | null, id: string | null) {
  return useSWR(
    token && id ? `/api/slos/${id}/evaluations` : null,
    workspaceSwrConfig(token),
  );
}

// Mutation helpers
export function createSlo(
  token: string,
  data: { name: string; indicator: string; entityType: string; entityId: string; target: number; windowDays: number },
) {
  return workspaceMutate(token, "/api/slos", "POST", data);
}

export function deleteSlo(token: string, id: string) {
  return workspaceMutate(token, `/api/slos/${id}`, "DELETE");
}
