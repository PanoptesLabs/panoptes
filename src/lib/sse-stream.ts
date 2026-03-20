import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { STREAM_DEFAULTS } from "@/lib/constants";
import { logger } from "@/lib/logger";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an SSE ReadableStream that polls OutboxEvent and pushes new events.
 * Shared between authenticated (/api/stream) and public (/api/stream/public) endpoints.
 */
export function createSSEStream(
  request: NextRequest,
  baseFilter: Record<string, unknown>,
  initialSeq: number,
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let currentSeq = initialSeq;
      let aborted = false;

      request.signal.addEventListener("abort", () => {
        aborted = true;
      });

      const run = async () => {
        // Send initial heartbeat so client knows connection is alive
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          return;
        }

        let heartbeatCounter = 0;

        const MAX_DURATION_MS = 300_000; // 5 minutes
        const deadline = Date.now() + MAX_DURATION_MS;

        while (!aborted && Date.now() < deadline) {
          try {
            const events = await prisma.outboxEvent.findMany({
              where: { seq: { gt: currentSeq }, ...baseFilter },
              orderBy: { seq: "asc" },
              take: STREAM_DEFAULTS.BATCH_SIZE,
            });

            for (const event of events) {
              const data = `id: ${event.seq}\nevent: ${event.type}\ndata: ${event.payload}\n\n`;
              controller.enqueue(encoder.encode(data));
              currentSeq = event.seq;
            }
          } catch (error) {
            logger.error("SSE", error);
          }

          // Heartbeat every ~5 poll cycles (15s)
          heartbeatCounter++;
          if (heartbeatCounter >= 5) {
            heartbeatCounter = 0;
            try {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            } catch {
              break;
            }
          }

          await sleep(STREAM_DEFAULTS.POLL_INTERVAL_MS);
        }

        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      run();
    },
  });
}

/**
 * Resolve the initial sequence number from last-event-id header or DB tail.
 */
export async function resolveInitialSeq(
  request: NextRequest,
  baseFilter: Record<string, unknown>,
): Promise<number> {
  const lastEventId = request.headers.get("last-event-id");

  if (lastEventId) {
    const parsed = parseInt(lastEventId, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  const latest = await prisma.outboxEvent.findFirst({
    where: baseFilter,
    orderBy: { seq: "desc" },
    select: { seq: true },
  });

  return latest?.seq ?? 0;
}

/** Standard SSE response headers */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;
