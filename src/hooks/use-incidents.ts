"use client";

import useSWR from "swr";
import { workspaceSwrConfig } from "./use-api";
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
export async function acknowledgeIncident(token: string, id: string) {
  const res = await fetch(`/api/incidents/${id}/acknowledge`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to acknowledge incident");
  return res.json();
}

export async function resolveIncident(token: string, id: string) {
  const res = await fetch(`/api/incidents/${id}/resolve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to resolve incident");
  return res.json();
}

export async function addIncidentComment(token: string, id: string, message: string) {
  const res = await fetch(`/api/incidents/${id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ eventType: "comment", message }),
  });
  if (!res.ok) throw new Error("Failed to add comment");
  return res.json();
}
