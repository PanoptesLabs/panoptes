"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";

export function useForecasts(filters?: {
  entityType?: string;
  entityId?: string;
  metric?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.entityId) params.set("entityId", filters.entityId);
  if (filters?.metric) params.set("metric", filters.metric);
  const query = params.toString();
  return useSWR(`/api/forecasts${query ? `?${query}` : ""}`, pollingSwrConfig);
}
