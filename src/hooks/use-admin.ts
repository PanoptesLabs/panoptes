"use client";

import useSWR from "swr";
import { sessionSwrConfig, sessionMutate } from "./use-api";

// --- Types ---

export interface AdminOverviewData {
  users: { total: number };
  sessions: { active: number };
  members: Record<string, number>;
  resources: {
    webhooks: number;
    slos: number;
    incidents: number;
    policies: number;
    apiKeys: number;
  };
  deliveries24h: { success: number; failed: number };
  recentAudit: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  actorAddress: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface AdminMember {
  id: string;
  userId: string;
  address: string;
  role: string;
  activeSessions: number;
  sessions: { id: string; expiresAt: string; createdAt: string }[];
  joinedAt: string;
}

export interface AdminApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  tier: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminAccessData {
  members: AdminMember[];
  apiKeys: AdminApiKey[];
}

export interface AdminWebhook {
  id: string;
  name: string;
  isActive: boolean;
  totalDeliveries: number;
  successRate: number;
  lastDeliveryAt: string | null;
}

export interface AdminPolicy {
  id: string;
  name: string;
  isActive: boolean;
  dryRun: boolean;
  executionCount: number;
  lastTriggeredAt: string | null;
}

export interface AdminIncident {
  id: string;
  title: string;
  status: string;
  severity: string;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface AdminOperationsData {
  webhooks: AdminWebhook[];
  policies: AdminPolicy[];
  recentIncidents: AdminIncident[];
}

export interface AdminAuditData {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// --- Hooks ---

export function useAdminOverview() {
  return useSWR<AdminOverviewData>("/api/admin/overview", sessionSwrConfig);
}

export function useAdminAccess() {
  return useSWR<AdminAccessData>("/api/admin/access", sessionSwrConfig);
}

export function useAdminOperations() {
  return useSWR<AdminOperationsData>("/api/admin/operations", sessionSwrConfig);
}

export function useAdminAudit(opts?: { limit?: number; offset?: number; action?: string; resourceType?: string }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  if (opts?.action) params.set("action", opts.action);
  if (opts?.resourceType) params.set("resourceType", opts.resourceType);
  const query = params.toString();
  return useSWR<AdminAuditData>(
    `/api/admin/audit${query ? `?${query}` : ""}`,
    sessionSwrConfig,
  );
}

// --- Mutations ---

export function changeUserRole(memberId: string, role: string) {
  return sessionMutate(`/api/admin/access/members/${memberId}/role`, "POST", { role });
}

export function revokeSession(sessionId: string) {
  return sessionMutate(`/api/admin/access/sessions/${sessionId}/revoke`, "POST");
}

export function disableApiKey(keyId: string) {
  return sessionMutate(`/api/admin/access/keys/${keyId}/disable`, "POST");
}

export function disableWebhook(webhookId: string) {
  return sessionMutate(`/api/admin/operations/webhooks/${webhookId}/disable`, "POST");
}

export function disablePolicy(policyId: string) {
  return sessionMutate(`/api/admin/operations/policies/${policyId}/disable`, "POST");
}
