import { prisma } from "@/lib/db";
import { WEBHOOK_DISPATCH } from "@/lib/constants";
import { deliverWebhook } from "./deliver";

export interface DispatchResult {
  dispatched: number;
  delivered: number;
  retried: number;
  failed: number;
  duration: number;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function dispatchWebhooks(): Promise<DispatchResult> {
  const start = Date.now();
  let dispatched = 0, delivered = 0, retried = 0, failed = 0;

  const overBudget = () => Date.now() - start >= WEBHOOK_DISPATCH.BUDGET_MS;

  // ═══════════════════════════════════════════
  // PHASE A: Dispatch new events
  // ═══════════════════════════════════════════

  // A1. Read cursor (singleton, bootstrap: lastSeq=0)
  const cursor = await prisma.webhookCursor.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastSeq: 0 },
    update: {},
  });

  // A2. Fetch events after last cursor
  const events = await prisma.outboxEvent.findMany({
    where: { seq: { gt: cursor.lastSeq } },
    orderBy: { seq: "asc" },
    take: WEBHOOK_DISPATCH.BATCH_SIZE,
  });

  // A3. For each event, find matching webhooks and deliver
  let lastProcessedSeq = cursor.lastSeq;

  for (const event of events) {
    if (overBudget()) break;

    const webhookFilter: Record<string, unknown> = {
      isActive: true,
      events: { has: event.type },
    };
    // Workspace-scoped event → only that workspace's webhooks
    if (event.workspaceId) {
      webhookFilter.workspaceId = event.workspaceId;
    }

    const webhooks = await prisma.webhook.findMany({
      where: webhookFilter,
      select: { id: true, url: true, secretEncrypted: true },
    });

    let budgetExhausted = false;

    for (const webhook of webhooks) {
      if (overBudget()) {
        budgetExhausted = true;
        break;
      }

      // Claim: create delivery row first (atomic dedup via unique constraint)
      let deliveryId: string;
      try {
        const claimed = await prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            outboxEventId: event.id,
            eventType: event.type,
            payload: event.payload,
            success: false,
            attempts: 0,
          },
          select: { id: true },
        });
        deliveryId = claimed.id;
      } catch (err) {
        // Unique constraint violation → already claimed by another worker
        if (isUniqueViolation(err)) continue;
        throw err;
      }

      dispatched++;
      try {
        const result = await deliverWebhook(
          { webhookId: webhook.id, url: webhook.url, secretEncrypted: webhook.secretEncrypted },
          { outboxEventId: event.id, eventType: event.type, payload: event.payload },
        );

        if (result.success) {
          delivered++;
          await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              success: true,
              statusCode: result.statusCode,
              responseBody: result.responseBody,
              attempts: 1,
              deliveredAt: new Date(),
            },
          });
        } else {
          failed++;
          await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              statusCode: result.statusCode,
              responseBody: result.responseBody,
              attempts: 1,
              nextRetryAt: new Date(Date.now() + WEBHOOK_DISPATCH.RETRY_DELAYS_S[0] * 1000),
            },
          });
        }
      } catch {
        // Claimed row must not stay stuck — make it retryable
        failed++;
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            attempts: 1,
            nextRetryAt: new Date(Date.now() + WEBHOOK_DISPATCH.RETRY_DELAYS_S[0] * 1000),
          },
        }).catch(() => {}); // Best-effort — don't let recovery crash the worker
      }
    }

    // Only advance cursor past fully-processed events
    if (!budgetExhausted) {
      lastProcessedSeq = event.seq;
    }

    if (budgetExhausted) break;
  }

  // A4. Cursor compare-and-set (prevent race condition)
  if (lastProcessedSeq > cursor.lastSeq) {
    await prisma.$executeRaw`
      UPDATE "WebhookCursor"
      SET "lastSeq" = ${lastProcessedSeq}, "updatedAt" = NOW()
      WHERE "id" = 'singleton' AND "lastSeq" < ${lastProcessedSeq}
    `;
  }

  // ═══════════════════════════════════════════
  // PHASE B: Process pending retries
  // ═══════════════════════════════════════════

  if (!overBudget()) {
    const staleCutoff = new Date(Date.now() - WEBHOOK_DISPATCH.STALE_CLAIM_MS);

    const pendingRetries = await prisma.webhookDelivery.findMany({
      where: {
        success: false,
        OR: [
          // Normal retries: failed deliveries with pending retry time
          {
            nextRetryAt: { lte: new Date() },
            attempts: { lt: WEBHOOK_DISPATCH.MAX_ATTEMPTS },
          },
          // Stale claims: stuck rows from crashed workers (attempts=0, no nextRetryAt)
          {
            attempts: 0,
            nextRetryAt: null,
            createdAt: { lt: staleCutoff },
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

    for (const delivery of pendingRetries) {
      if (overBudget()) break;

      // Skip retry if webhook deactivated, mark as dead letter
      // Use Math.max to ensure stale claims (attempts=0) don't loop
      if (!delivery.webhook.isActive) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { nextRetryAt: null, attempts: Math.max(delivery.attempts, 1) },
        });
        continue;
      }

      retried++;
      const newAttempts = delivery.attempts + 1;
      const isDeadLetter = newAttempts >= WEBHOOK_DISPATCH.MAX_ATTEMPTS;

      try {
        const result = await deliverWebhook(
          {
            webhookId: delivery.webhook.id,
            url: delivery.webhook.url,
            secretEncrypted: delivery.webhook.secretEncrypted,
          },
          {
            outboxEventId: delivery.outboxEventId,
            eventType: delivery.eventType,
            payload: delivery.payload,
          },
        );

        if (result.success) {
          delivered++;
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              success: true,
              statusCode: result.statusCode,
              responseBody: result.responseBody,
              attempts: newAttempts,
              deliveredAt: new Date(),
              nextRetryAt: null,
            },
          });
        } else {
          failed++;
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              statusCode: result.statusCode,
              responseBody: result.responseBody,
              attempts: newAttempts,
              nextRetryAt: isDeadLetter
                ? null
                : new Date(Date.now() + (WEBHOOK_DISPATCH.RETRY_DELAYS_S[newAttempts - 1] ?? 21_600) * 1000),
            },
          });
        }
      } catch {
        // Unexpected error — bump attempts so row doesn't get stuck
        failed++;
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: newAttempts,
            nextRetryAt: isDeadLetter
              ? null
              : new Date(Date.now() + (WEBHOOK_DISPATCH.RETRY_DELAYS_S[newAttempts - 1] ?? 21_600) * 1000),
          },
        }).catch(() => {});
      }
    }
  }

  return { dispatched, delivered, retried, failed, duration: Date.now() - start };
}
