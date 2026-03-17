"use client";

import useSWR from "swr";
import { workspaceSwrConfig, workspaceMutate } from "./use-api";
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
export function createWebhook(
  token: string,
  data: { name: string; url: string; events: string[] },
) {
  return workspaceMutate<WebhookItem>(token, "/api/webhooks", "POST", data);
}

export function deleteWebhook(token: string, id: string) {
  return workspaceMutate(token, `/api/webhooks/${id}`, "DELETE");
}

export function testWebhook(token: string, id: string) {
  return workspaceMutate<Record<string, unknown>>(token, `/api/webhooks/${id}/test`, "POST");
}
