"use client";

import useSWR from "swr";
import { workspaceSwrConfig, workspaceMutate } from "./use-api";
import type { IncidentListResponse, IncidentSummary, IncidentItem } from "@/types";

interface IncidentFilters {
  status?: string;
  severity?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

export function useIncidents(token: string | null, filters?: IncidentFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const query = params.toString();
  const url = `/api/incidents${query ? `?${query}` : ""}`;

  return useSWR<IncidentListResponse>(
    token ? url : null,
    workspaceSwrConfig(token),
  );
}

export function useIncidentSummary(token: string | null) {
  return useSWR<IncidentSummary>(
    token ? "/api/incidents/summary" : null,
    workspaceSwrConfig(token),
  );
}

export function useIncidentDetail(token: string | null, id: string | null) {
  return useSWR<IncidentItem>(
    token && id ? `/api/incidents/${id}` : null,
    workspaceSwrConfig(token),
  );
}

// Mutation helpers
export function acknowledgeIncident(token: string, id: string) {
  return workspaceMutate(token, `/api/incidents/${id}`, "PATCH", { status: "acknowledged" });
}

export function resolveIncident(token: string, id: string) {
  return workspaceMutate(token, `/api/incidents/${id}`, "PATCH", { status: "resolved" });
}

export function addIncidentComment(token: string, id: string, message: string) {
  return workspaceMutate(token, `/api/incidents/${id}/events`, "POST", { eventType: "comment", message });
}
