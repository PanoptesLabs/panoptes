"use client";

import useSWR from "swr";
import { sessionSwrConfig, sessionMutate } from "./use-api";
import type { SloSummary, SloItem } from "@/types";

export function useSloSummary() {
  return useSWR<SloSummary>(
    "/api/slos/summary",
    sessionSwrConfig,
  );
}

export function useSloDetail(id: string | null) {
  return useSWR<SloItem>(
    id ? `/api/slos/${id}` : null,
    sessionSwrConfig,
  );
}

export function useSloEvaluations(id: string | null) {
  return useSWR(
    id ? `/api/slos/${id}/evaluations` : null,
    sessionSwrConfig,
  );
}

// Mutation helpers
export function createSlo(
  data: { name: string; indicator: string; entityType: string; entityId: string; target: number; windowDays: number },
) {
  return sessionMutate("/api/slos", "POST", data);
}

export function deleteSlo(id: string) {
  return sessionMutate(`/api/slos/${id}`, "DELETE");
}
