"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";

export function useForecasts(filters?: {
  entityType?: string;
  entityId?: string;
  metric?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.entityId) params.set("entityId", filters.entityId);
  if (filters?.metric) params.set("metric", filters.metric);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  const query = params.toString();
  return useSWR(`/api/forecasts${query ? `?${query}` : ""}`, pollingSwrConfig);
}
