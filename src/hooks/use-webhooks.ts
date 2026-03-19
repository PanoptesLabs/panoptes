"use client";

import useSWR from "swr";
import { sessionSwrConfig, sessionMutate } from "./use-api";
import type { WebhookItem, WebhookDeliveryResponse } from "@/types";

export function useWebhooks() {
  return useSWR<{ webhooks: WebhookItem[] }>(
    "/api/webhooks",
    sessionSwrConfig,
  );
}

export function useWebhookDetail(id: string | null) {
  return useSWR<WebhookItem>(
    id ? `/api/webhooks/${id}` : null,
    sessionSwrConfig,
  );
}

export function useWebhookDeliveries(
  id: string | null,
  opts?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/webhooks/${id}/deliveries${query ? `?${query}` : ""}`;

  return useSWR<WebhookDeliveryResponse>(
    id ? url : null,
    sessionSwrConfig,
  );
}

// Mutation helpers
export function createWebhook(
  data: { name: string; url: string; events: string[] },
) {
  return sessionMutate<WebhookItem>("/api/webhooks", "POST", data);
}

export function deleteWebhook(id: string) {
  return sessionMutate(`/api/webhooks/${id}`, "DELETE");
}

export function testWebhook(id: string) {
  return sessionMutate<Record<string, unknown>>(`/api/webhooks/${id}/test`, "POST");
}
