"use client";

import useSWR from "swr";
import { workspaceSwrConfig } from "./use-api";
import type { WebhookItem, WebhookDeliveryResponse } from "@/types";

export function useWebhooks(token: string | null) {
  return useSWR<{ webhooks: WebhookItem[] }>(
    token ? "/api/webhooks" : null,
    workspaceSwrConfig(token),
  );
}

export function useWebhookDetail(token: string | null, id: string | null) {
  return useSWR<WebhookItem>(
    token && id ? `/api/webhooks/${id}` : null,
    workspaceSwrConfig(token),
  );
}

export function useWebhookDeliveries(
  token: string | null,
  id: string | null,
  opts?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/webhooks/${id}/deliveries${query ? `?${query}` : ""}`;

  return useSWR<WebhookDeliveryResponse>(
    token && id ? url : null,
    workspaceSwrConfig(token),
  );
}

// Mutation helpers
export async function createWebhook(
  token: string,
  data: { name: string; url: string; events: string[] },
) {
  const res = await fetch("/api/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create webhook");
  return res.json();
}

export async function deleteWebhook(token: string, id: string) {
  const res = await fetch(`/api/webhooks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete webhook");
}

export async function testWebhook(token: string, id: string) {
  const res = await fetch(`/api/webhooks/${id}/test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to test webhook");
  return res.json();
}
