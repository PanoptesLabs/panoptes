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
  // 1. SSRF check (DNS resolution time)
  try {
    await assertUrlNotPrivate(target.url);
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

  // 3. HTTP POST with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_DISPATCH.TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event.eventType,
        "X-Webhook-Delivery": event.outboxEventId,
      },
      body: event.payload,
      signal: controller.signal,
      redirect: "manual",
    });

    // 4. Post-fetch DNS rebinding check: re-resolve and verify IP is still safe
    try {
      await assertUrlNotPrivate(target.url);
    } catch {
      return { success: false, statusCode: null, responseBody: null, error: "SSRF: DNS rebinding detected" };
    }

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
  }
}
