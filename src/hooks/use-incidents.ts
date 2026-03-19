"use client";

import useSWR from "swr";
import { sessionSwrConfig, sessionMutate } from "./use-api";
import type { IncidentListResponse, IncidentSummary, IncidentItem } from "@/types";

interface IncidentFilters {
  status?: string;
  severity?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

export function useIncidents(filters?: IncidentFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const query = params.toString();
  const url = `/api/incidents${query ? `?${query}` : ""}`;

  return useSWR<IncidentListResponse>(
    url,
    sessionSwrConfig,
  );
}

export function useIncidentSummary() {
  return useSWR<IncidentSummary>(
    "/api/incidents/summary",
    sessionSwrConfig,
  );
}

export function useIncidentDetail(id: string | null) {
  return useSWR<IncidentItem>(
    id ? `/api/incidents/${id}` : null,
    sessionSwrConfig,
  );
}

// Mutation helpers
export function acknowledgeIncident(id: string) {
  return sessionMutate(`/api/incidents/${id}`, "PATCH", { status: "acknowledged" });
}

export function resolveIncident(id: string) {
  return sessionMutate(`/api/incidents/${id}`, "PATCH", { status: "resolved" });
}

export function addIncidentComment(id: string, message: string) {
  return sessionMutate(`/api/incidents/${id}/events`, "POST", { eventType: "comment", message });
}
