import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookCursor: { upsert: vi.fn() },
    outboxEvent: { findMany: vi.fn() },
    webhook: { findMany: vi.fn() },
    webhookDelivery: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/webhook-crypto", () => ({
  decryptSecret: vi.fn(() => "plain-secret"),
  signPayload: vi.fn(() => "mock-signature"),
}));

vi.mock("@/lib/webhook-validation", () => ({
  assertUrlNotPrivate: vi.fn().mockResolvedValue({ address: "93.184.216.34", family: 4 }),
}));

vi.mock("undici", () => ({
  Agent: class MockAgent {
    close = vi.fn();
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { dispatchWebhooks } from "@/lib/webhooks/dispatch";
import { prisma } from "@/lib/db";
import { assertUrlNotPrivate } from "@/lib/webhook-validation";
import { WEBHOOK_DISPATCH } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockAssertUrl = assertUrlNotPrivate as ReturnType<typeof vi.fn>;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    seq: 1,
    channel: "anomaly",
    type: "anomaly.created",
    visibility: "public",
    workspaceId: null,
    payload: '{"test":true}',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh-1",
    url: "https://example.com/webhook",
    secretEncrypted: "encrypted-secret",
    ...overrides,
  };
}

function mockFetchSuccess(status = 200, body = "OK") {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  });
}

function mockFetchFailure(status = 500, body = "Internal Server Error") {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

/** Setup Phase A: event + webhook + successful claim */
function setupPhaseA(
  event = makeEvent(),
  webhook = makeWebhook(),
) {
  mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
  mockPrisma.webhook.findMany.mockResolvedValue([webhook]);
  mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-claimed" });
  mockPrisma.webhookDelivery.update.mockResolvedValue({});
}

describe("dispatchWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.webhookCursor.upsert.mockResolvedValue({ id: "singleton", lastSeq: 0 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockAssertUrl.mockResolvedValue({ address: "93.184.216.34", family: 4 });
  });

  // ═══════════════════════════════════════════
  // PHASE A: New Event Dispatch
  // ═══════════════════════════════════════════

  it("bootstraps cursor with upsert (singleton)", async () => {
    await dispatchWebhooks();

    expect(mockPrisma.webhookCursor.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", lastSeq: 0 },
      update: {},
    });
  });

  it("returns zeros when no events exist", async () => {
    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(0);
    expect(result.delivered).toBe(0);
    expect(result.retried).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("claims delivery then updates on success (atomic dedup)", async () => {
    setupPhaseA();
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(1);
    expect(result.delivered).toBe(1);
    // Step 1: claim row (attempts=0, success=false)
    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        webhookId: "wh-1",
        outboxEventId: "evt-1",
        success: false,
        attempts: 0,
      }),
      select: { id: true },
    });
    // Step 2: update with result
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-claimed" },
      data: expect.objectContaining({
        success: true,
        statusCode: 200,
        attempts: 1,
        deliveredAt: expect.any(Date),
      }),
    });
  });

  it("dispatches single event to multiple webhooks", async () => {
    const event = makeEvent();
    const wh1 = makeWebhook({ id: "wh-1" });
    const wh2 = makeWebhook({ id: "wh-2", url: "https://example2.com/webhook" });

    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([wh1, wh2]);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-claimed" });
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(2);
    expect(result.delivered).toBe(2);
    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
  });

  it("dispatches multiple events and advances cursor to last seq", async () => {
    const events = [
      makeEvent({ id: "evt-1", seq: 5 }),
      makeEvent({ id: "evt-2", seq: 6 }),
      makeEvent({ id: "evt-3", seq: 7 }),
    ];
    mockPrisma.outboxEvent.findMany.mockResolvedValue(events);
    mockPrisma.webhook.findMany.mockResolvedValue([makeWebhook()]);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-claimed" });
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(3);
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("skips duplicate delivery via unique constraint violation", async () => {
    const event = makeEvent();
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([makeWebhook()]);
    // Simulate Prisma P2002 unique constraint violation
    const uniqueError = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockPrisma.webhookDelivery.create.mockRejectedValue(uniqueError);

    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrisma.webhookDelivery.update).not.toHaveBeenCalled();
  });

  it("counts non-unique-constraint claim errors as failed", async () => {
    const event = makeEvent();
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([makeWebhook()]);
    mockPrisma.webhookDelivery.create.mockRejectedValue(new Error("DB connection lost"));

    const result = await dispatchWebhooks();
    expect(result.dispatched).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("recovers claimed row on unexpected post-claim error", async () => {
    const event = makeEvent();
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([makeWebhook()]);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-claimed" });
    // deliverWebhook itself won't throw (crypto errors are caught in deliver.ts)
    // but the update after it can throw
    mockPrisma.webhookDelivery.update
      .mockRejectedValueOnce(new Error("DB write failed")) // result update fails
      .mockResolvedValue({}); // recovery update succeeds

    mockFetchSuccess();

    const result = await dispatchWebhooks();

    // Should have counted as failed, not thrown
    expect(result.failed).toBe(1);
    // Recovery update should have been called with nextRetryAt
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-claimed" },
      data: expect.objectContaining({
        attempts: 1,
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it("filters webhooks by workspace for workspace-scoped events", async () => {
    const event = makeEvent({ workspaceId: "ws-1" });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([]);

    await dispatchWebhooks();

    expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        events: { has: "anomaly.created" },
        workspaceId: "ws-1",
      },
      select: { id: true, url: true, secretEncrypted: true },
    });
  });

  it("does not filter by workspace for public events", async () => {
    const event = makeEvent({ workspaceId: null });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([]);

    await dispatchWebhooks();

    expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        events: { has: "anomaly.created" },
      },
      select: { id: true, url: true, secretEncrypted: true },
    });
  });

  it("skips webhooks that don't match event type (via Prisma filter)", async () => {
    const event = makeEvent({ type: "validator.jailed" });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([event]);
    mockPrisma.webhook.findMany.mockResolvedValue([]);

    const result = await dispatchWebhooks();

    expect(result.dispatched).toBe(0);
    expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          events: { has: "validator.jailed" },
        }),
      }),
    );
  });

  it("records successful delivery with deliveredAt", async () => {
    setupPhaseA();
    mockFetchSuccess(200, "received");

    await dispatchWebhooks();

    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-claimed" },
      data: expect.objectContaining({
        success: true,
        statusCode: 200,
        responseBody: "received",
        attempts: 1,
        deliveredAt: expect.any(Date),
      }),
    });
  });

  it("records failed delivery with nextRetryAt", async () => {
    setupPhaseA();
    mockFetchFailure(500, "error");

    const result = await dispatchWebhooks();

    expect(result.failed).toBe(1);
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-claimed" },
      data: expect.objectContaining({
        statusCode: 500,
        attempts: 1,
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it("handles SSRF blocked address", async () => {
    setupPhaseA();
    mockAssertUrl.mockRejectedValue(new Error("blocked"));

    const result = await dispatchWebhooks();

    expect(result.failed).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-claimed" },
      data: expect.objectContaining({
        statusCode: null,
        responseBody: null,
        attempts: 1,
      }),
    });
  });

  it("does not advance cursor when no events", async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    await dispatchWebhooks();

    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("only advances cursor past fully-processed events on budget exhaustion", async () => {
    // Simulate budget exhaustion after first event by mocking Date.now
    const realNow = Date.now;
    let callCount = 0;
    const baseTime = realNow();
    vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      // First few calls: normal time. After event 1 is processed, jump past budget.
      if (callCount > 8) return baseTime + WEBHOOK_DISPATCH.BUDGET_MS + 1;
      return baseTime;
    });

    const events = [
      makeEvent({ id: "evt-1", seq: 10 }),
      makeEvent({ id: "evt-2", seq: 11 }),
    ];
    mockPrisma.outboxEvent.findMany.mockResolvedValue(events);
    mockPrisma.webhook.findMany.mockResolvedValue([makeWebhook()]);
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: "del-claimed" });
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    // Should have processed at least 1 event but not necessarily both
    expect(result.dispatched).toBeGreaterThanOrEqual(1);
    // Cursor should have been advanced (at least first event processed)
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();

    vi.spyOn(Date, "now").mockRestore();
  });

  // ═══════════════════════════════════════════
  // PHASE B: Retry
  // ═══════════════════════════════════════════

  it("queries for both pending retries and stale claims", async () => {
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);

    await dispatchWebhooks();

    expect(mockPrisma.webhookDelivery.findMany).toHaveBeenCalledWith({
      where: {
        success: false,
        OR: [
          {
            nextRetryAt: { lte: expect.any(Date) },
            attempts: { lt: WEBHOOK_DISPATCH.MAX_ATTEMPTS },
          },
          {
            attempts: 0,
            nextRetryAt: null,
            createdAt: { lt: expect.any(Date) },
          },
        ],
      },
      include: {
        webhook: {
          select: { id: true, url: true, secretEncrypted: true, isActive: true },
        },
      },
      take: WEBHOOK_DISPATCH.RETRY_BATCH_SIZE,
      orderBy: { nextRetryAt: "asc" },
    });
  });

  it("retries successfully and updates delivery", async () => {
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 1,
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchSuccess(200, "ok");

    const result = await dispatchWebhooks();

    expect(result.retried).toBe(1);
    expect(result.delivered).toBe(1);
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-1" },
      data: expect.objectContaining({
        success: true,
        attempts: 2,
        deliveredAt: expect.any(Date),
        nextRetryAt: null,
      }),
    });
  });

  it("retries failed and updates nextRetryAt for next attempt", async () => {
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 2,
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchFailure(502, "Bad Gateway");

    const result = await dispatchWebhooks();

    expect(result.retried).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-1" },
      data: expect.objectContaining({
        attempts: 3,
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it("marks as dead letter when max attempts reached", async () => {
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 4, // Next will be 5 = MAX_ATTEMPTS
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchFailure(500, "error");

    const result = await dispatchWebhooks();

    expect(result.failed).toBe(1);
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-1" },
      data: expect.objectContaining({
        attempts: 5,
        nextRetryAt: null, // dead letter
      }),
    });
  });

  it("skips retry for deactivated webhook and marks dead letter", async () => {
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 1,
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: false,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});

    const result = await dispatchWebhooks();

    expect(result.retried).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-1" },
      data: { nextRetryAt: null, attempts: 1 },
    });
  });

  it("recovers retry row on unexpected error during retry phase", async () => {
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 2,
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    // First update (result) throws, second update (recovery) succeeds
    mockPrisma.webhookDelivery.update
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValue({});
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    // Should count as failed, not crash the worker
    expect(result.failed).toBe(1);
    // Recovery update bumps attempts and sets nextRetryAt
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-1" },
      data: expect.objectContaining({
        attempts: 3,
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it("uses correct exponential backoff delays (no off-by-one)", async () => {
    // attempts=1 → newAttempts=2 → RETRY_DELAYS_S[2-1] = RETRY_DELAYS_S[1] = 120s
    const pendingDelivery = {
      id: "del-1",
      webhookId: "wh-1",
      outboxEventId: "evt-1",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 1,
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchFailure();

    const before = Date.now();
    await dispatchWebhooks();

    const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
    const nextRetry = updateCall.data.nextRetryAt.getTime();
    // newAttempts = 2, RETRY_DELAYS_S[2-1] = RETRY_DELAYS_S[1] = 120s
    const expectedDelay = WEBHOOK_DISPATCH.RETRY_DELAYS_S[1] * 1000;
    expect(nextRetry).toBeGreaterThanOrEqual(before + expectedDelay - 100);
    expect(nextRetry).toBeLessThanOrEqual(before + expectedDelay + 1000);
  });

  it("walks through all backoff delays in sequence", async () => {
    // Verify each attempt uses the correct delay index
    for (let currentAttempts = 1; currentAttempts < WEBHOOK_DISPATCH.MAX_ATTEMPTS; currentAttempts++) {
      vi.clearAllMocks();
      mockPrisma.webhookCursor.upsert.mockResolvedValue({ id: "singleton", lastSeq: 0 });
      mockPrisma.outboxEvent.findMany.mockResolvedValue([]);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockAssertUrl.mockResolvedValue({ address: "93.184.216.34", family: 4 });

      const pendingDelivery = {
        id: `del-${currentAttempts}`,
        webhookId: "wh-1",
        outboxEventId: "evt-1",
        eventType: "anomaly.created",
        payload: '{"test":true}',
        attempts: currentAttempts,
        webhook: {
          id: "wh-1",
          url: "https://example.com/webhook",
          secretEncrypted: "encrypted-secret",
          isActive: true,
        },
      };
      mockPrisma.webhookDelivery.findMany.mockResolvedValue([pendingDelivery]);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});
      mockFetchFailure();

      const before = Date.now();
      await dispatchWebhooks();

      const newAttempts = currentAttempts + 1;
      if (newAttempts >= WEBHOOK_DISPATCH.MAX_ATTEMPTS) {
        // Dead letter
        const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
        expect(updateCall.data.nextRetryAt).toBeNull();
      } else {
        const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
        const nextRetry = updateCall.data.nextRetryAt.getTime();
        const expectedDelay = WEBHOOK_DISPATCH.RETRY_DELAYS_S[newAttempts - 1] * 1000;
        expect(nextRetry).toBeGreaterThanOrEqual(before + expectedDelay - 100);
        expect(nextRetry).toBeLessThanOrEqual(before + expectedDelay + 1000);
      }
    }
  });

  // ═══════════════════════════════════════════
  // Integration: return value & edge cases
  // ═══════════════════════════════════════════

  it("returns correct DispatchResult structure", async () => {
    const result = await dispatchWebhooks();

    expect(result).toEqual({
      dispatched: expect.any(Number),
      delivered: expect.any(Number),
      retried: expect.any(Number),
      failed: expect.any(Number),
      duration: expect.any(Number),
    });
  });

  it("truncates response body to 1024 bytes", async () => {
    setupPhaseA();
    const longBody = "x".repeat(2000);
    mockFetchSuccess(200, longBody);

    await dispatchWebhooks();

    const updateCall = mockPrisma.webhookDelivery.update.mock.calls[0][0];
    expect(updateCall.data.responseBody.length).toBe(1024);
  });

  // ═══════════════════════════════════════════
  // Stale-claim recovery
  // ═══════════════════════════════════════════

  it("does not crash when both result and recovery updates fail", async () => {
    setupPhaseA();
    mockFetchSuccess();
    // All updates fail — both result update and recovery update
    mockPrisma.webhookDelivery.update.mockRejectedValue(new Error("DB down"));

    // Worker should NOT throw — catch(() => {}) absorbs the error
    const result = await dispatchWebhooks();

    expect(result.failed).toBe(1);
  });

  it("picks up stale claims (stuck rows) in retry phase", async () => {
    const staleDelivery = {
      id: "del-stale",
      webhookId: "wh-1",
      outboxEventId: "evt-old",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 0,
      nextRetryAt: null,
      createdAt: new Date(Date.now() - 600_000), // 10 min ago — past stale threshold
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: true,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([staleDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});
    mockFetchSuccess();

    const result = await dispatchWebhooks();

    expect(result.retried).toBe(1);
    expect(result.delivered).toBe(1);
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-stale" },
      data: expect.objectContaining({
        success: true,
        attempts: 1,
        deliveredAt: expect.any(Date),
        nextRetryAt: null,
      }),
    });
  });

  it("marks stale claim as dead letter when webhook is deactivated", async () => {
    const staleDelivery = {
      id: "del-stale",
      webhookId: "wh-1",
      outboxEventId: "evt-old",
      eventType: "anomaly.created",
      payload: '{"test":true}',
      attempts: 0,
      nextRetryAt: null,
      createdAt: new Date(Date.now() - 600_000),
      webhook: {
        id: "wh-1",
        url: "https://example.com/webhook",
        secretEncrypted: "encrypted-secret",
        isActive: false,
      },
    };
    mockPrisma.webhookDelivery.findMany.mockResolvedValue([staleDelivery]);
    mockPrisma.webhookDelivery.update.mockResolvedValue({});

    await dispatchWebhooks();

    // Bumps attempts to 1 so it won't loop as stale claim again
    expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "del-stale" },
      data: { nextRetryAt: null, attempts: 1 },
    });
  });
});
