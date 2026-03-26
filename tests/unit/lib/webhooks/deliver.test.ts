import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/webhook-crypto", () => ({
  decryptSecret: vi.fn().mockReturnValue("decrypted-secret"),
  signPayload: vi.fn().mockReturnValue("sig-abc"),
}));

vi.mock("@/lib/webhook-validation", () => ({
  assertUrlNotPrivate: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
}));

const mockAgentClose = vi.fn();
vi.mock("undici", () => ({
  Agent: class MockAgent {
    close = mockAgentClose;
  },
}));

import { deliverWebhook, type DeliveryTarget, type DeliveryPayload } from "@/lib/webhooks/deliver";
import { decryptSecret, signPayload } from "@/lib/webhook-crypto";
import { assertUrlNotPrivate } from "@/lib/webhook-validation";

const target: DeliveryTarget = {
  webhookId: "wh-1",
  url: "https://example.com/webhook",
  secretEncrypted: "encrypted-secret",
};

const event: DeliveryPayload = {
  outboxEventId: "ev-1",
  eventType: "anomaly.created",
  payload: '{"test":true}',
};

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mocks to default behavior
  vi.mocked(decryptSecret).mockReturnValue("decrypted-secret");
  vi.mocked(signPayload).mockReturnValue("sig-abc");
  vi.mocked(assertUrlNotPrivate).mockResolvedValue({ address: "93.184.216.34", family: 4 });
});

describe("deliverWebhook", () => {
  it("delivers successfully on 200", async () => {
    mockFetch.mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("resolves DNS once and pins via undici dispatcher", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook(target, event);

    // DNS resolved exactly once (no post-fetch re-resolve)
    expect(assertUrlNotPrivate).toHaveBeenCalledWith(target.url);
    expect(assertUrlNotPrivate).toHaveBeenCalledTimes(1);
    // fetch called with dispatcher option (undici Agent instance)
    expect(mockFetch).toHaveBeenCalledWith(
      target.url,
      expect.objectContaining({
        dispatcher: expect.objectContaining({ close: expect.any(Function) }),
      }),
    );
  });

  it("blocks SSRF on pre-fetch check", async () => {
    vi.mocked(assertUrlNotPrivate).mockRejectedValueOnce(new Error("private IP"));

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.error).toContain("SSRF");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("decrypts secret and signs payload", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook(target, event);

    expect(decryptSecret).toHaveBeenCalledWith("encrypted-secret");
    expect(signPayload).toHaveBeenCalledWith("decrypted-secret", '{"test":true}');
  });

  it("sends correct headers", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook(target, event);

    expect(fetch).toHaveBeenCalledWith(
      target.url,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Webhook-Signature": "sig-abc",
          "X-Webhook-Event": "anomaly.created",
          "X-Webhook-Delivery": "ev-1",
        }),
        body: '{"test":true}',
      }),
    );
  });

  it("reports failure on 4xx", async () => {
    mockFetch.mockResolvedValue(new Response("bad request", { status: 400 }));

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("reports failure on 5xx", async () => {
    mockFetch.mockResolvedValue(new Response("error", { status: 500 }));

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it("handles fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.error).toBe("network error");
    expect(result.statusCode).toBeNull();
  });

  it("handles crypto error", async () => {
    vi.mocked(decryptSecret).mockImplementation(() => {
      throw new Error("decrypt failed");
    });

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Crypto");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("truncates response body to 1024 chars", async () => {
    const longBody = "x".repeat(2000);
    mockFetch.mockResolvedValue(new Response(longBody, { status: 200 }));

    const result = await deliverWebhook(target, event);

    expect(result.responseBody).not.toBeNull();
    expect(result.responseBody?.length).toBe(1024);
  });

  it("sets redirect to manual", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook(target, event);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options).toHaveProperty("redirect", "manual");
  });

  it("handles abort timeout", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns null responseBody on text() error", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockRejectedValue(new Error("read failed")),
    };
    mockFetch.mockResolvedValue(mockResponse as unknown as Response);

    const result = await deliverWebhook(target, event);

    expect(result.success).toBe(true);
    expect(result.responseBody).toBeNull();
  });

  it("closes undici agent after successful delivery", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook(target, event);

    expect(mockAgentClose).toHaveBeenCalled();
  });

  it("closes undici agent after fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    await deliverWebhook(target, event);

    expect(mockAgentClose).toHaveBeenCalled();
  });
});
