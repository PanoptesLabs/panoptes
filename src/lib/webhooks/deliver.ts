import { Agent } from "undici";
import { decryptSecret, signPayload } from "@/lib/webhook-crypto";
import { assertUrlNotPrivate } from "@/lib/webhook-validation";
import { WEBHOOK_DISPATCH } from "@/lib/constants";

export interface DeliveryTarget {
  webhookId: string;
  url: string;
  secretEncrypted: string;
}

export interface DeliveryPayload {
  outboxEventId: string;
  eventType: string;
  payload: string;
}

export interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  error?: string;
}

export async function deliverWebhook(
  target: DeliveryTarget,
  event: DeliveryPayload,
): Promise<DeliveryResult> {
  // 1. SSRF check — resolve DNS and pin the IP
  let resolvedAddress: string;
  try {
    const resolved = await assertUrlNotPrivate(target.url);
    resolvedAddress = resolved.address;
  } catch {
    return { success: false, statusCode: null, responseBody: null, error: "SSRF: blocked address" };
  }

  // 2. Decrypt secret + sign payload
  let secret: string;
  let signature: string;
  try {
    secret = decryptSecret(target.secretEncrypted);
    signature = signPayload(secret, event.payload);
  } catch (err) {
    return {
      success: false,
      statusCode: null,
      responseBody: null,
      error: `Crypto: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  // 3. HTTP POST with pinned DNS (prevents TOCTOU / DNS rebinding)
  const pinnedAgent = new Agent({
    connect: { host: resolvedAddress },
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_DISPATCH.TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Panoptes-Webhook/1.0",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event.eventType,
        "X-Webhook-Delivery": event.outboxEventId,
      },
      body: event.payload,
      signal: controller.signal,
      redirect: "manual",
      // @ts-expect-error -- Node.js fetch supports undici dispatcher
      dispatcher: pinnedAgent,
    });

    const responseBody = await response.text().catch(() => null);

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody?.slice(0, 1024) ?? null,
    };
  } catch (err) {
    return {
      success: false,
      statusCode: null,
      responseBody: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
    pinnedAgent.close();
  }
}
