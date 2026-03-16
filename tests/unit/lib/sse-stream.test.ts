import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    outboxEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { resolveInitialSeq, SSE_HEADERS, createSSEStream } from "@/lib/sse-stream";

describe("SSE_HEADERS", () => {
  it("includes correct content type", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
  });

  it("includes cache-control", () => {
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache, no-transform");
  });

  it("includes keep-alive connection", () => {
    expect(SSE_HEADERS.Connection).toBe("keep-alive");
  });
});

describe("resolveInitialSeq", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed Last-Event-ID when present", async () => {
    const req = new NextRequest("http://localhost/api/stream", {
      headers: { "Last-Event-ID": "42" },
    });
    const seq = await resolveInitialSeq(req, { visibility: "public" });
    expect(seq).toBe(42);
    expect(prisma.outboxEvent.findFirst).not.toHaveBeenCalled();
  });

  it("returns 0 for invalid Last-Event-ID", async () => {
    const req = new NextRequest("http://localhost/api/stream", {
      headers: { "Last-Event-ID": "abc" },
    });
    const seq = await resolveInitialSeq(req, { visibility: "public" });
    expect(seq).toBe(0);
  });

  it("queries DB tail when no Last-Event-ID", async () => {
    vi.mocked(prisma.outboxEvent.findFirst).mockResolvedValue({ seq: 99 } as never);

    const req = new NextRequest("http://localhost/api/stream");
    const seq = await resolveInitialSeq(req, { visibility: "public" });

    expect(seq).toBe(99);
    expect(prisma.outboxEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { visibility: "public" },
        orderBy: { seq: "desc" },
      }),
    );
  });

  it("returns 0 when DB has no events", async () => {
    vi.mocked(prisma.outboxEvent.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/stream");
    const seq = await resolveInitialSeq(req, { visibility: "public" });
    expect(seq).toBe(0);
  });
});

describe("createSSEStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits initial heartbeat", async () => {
    vi.mocked(prisma.outboxEvent.findMany).mockResolvedValue([]);

    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream", {
      signal: controller.signal,
    });

    const stream = createSSEStream(req, { visibility: "public" }, 0);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    expect(decoder.decode(value)).toContain(": heartbeat");

    controller.abort();
    reader.releaseLock();
  });

  it("emits events in SSE format", async () => {
    const mockEvent = {
      seq: 5,
      type: "anomaly.created",
      payload: '{"test":true}',
    };
    vi.mocked(prisma.outboxEvent.findMany)
      .mockResolvedValueOnce([mockEvent] as never)
      .mockResolvedValue([]);

    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream", {
      signal: controller.signal,
    });

    const stream = createSSEStream(req, { visibility: "public" }, 0);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let output = "";
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      if (output.includes("anomaly.created")) break;
    }

    controller.abort();
    reader.releaseLock();

    expect(output).toContain("id: 5\n");
    expect(output).toContain("event: anomaly.created\n");
    expect(output).toContain('data: {"test":true}\n');
  });
});
