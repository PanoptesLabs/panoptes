"use client";

import useSWR from "swr";
import { workspaceSwrConfig, createWorkspaceFetcher } from "./use-api";
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
export async function createSlo(
  token: string,
  data: { name: string; indicator: string; entityType: string; entityId: string; target: number; windowDays: number },
) {
  const res = await fetch("/api/slos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create SLO");
  return res.json();
}

export async function deleteSlo(token: string, id: string) {
  const fetcher = createWorkspaceFetcher(token);
  return fetcher(`/api/slos/${id}`).catch(() => {
    // Use DELETE method instead
    return fetch(`/api/slos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to delete SLO");
    });
  });
}
