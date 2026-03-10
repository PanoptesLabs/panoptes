"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";
import type { AnomalyApiResponse } from "@/types";

interface AnomalyFilters {
  type?: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export function useAnomalies(filters?: AnomalyFilters) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.resolved !== undefined) params.set("resolved", String(filters.resolved));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const query = params.toString();
  const url = `/api/anomalies${query ? `?${query}` : ""}`;

  return useSWR<AnomalyApiResponse>(url, pollingSwrConfig);
}
