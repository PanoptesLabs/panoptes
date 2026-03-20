import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// SWR mock
vi.mock("swr", () => ({
  useSWRConfig: () => ({
    mutate: vi.fn(),
  }),
}));

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: ((e: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((h) => h !== handler);
    }
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    this.listeners[type]?.forEach((h) => h(event));
  }

  triggerError() {
    const event = new Event("error");
    this.onerror?.(event);
  }
}

vi.stubGlobal("EventSource", MockEventSource);

import { useEventStream } from "@/hooks/use-event-stream";

describe("useEventStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
  });

  afterEach(() => {
    MockEventSource.instances = [];
  });

  it("creates EventSource with correct URL", () => {
    renderHook(() => useEventStream({ url: "/api/stream" }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/stream");
  });

  it("does not create EventSource when disabled", () => {
    renderHook(() => useEventStream({ url: "/api/stream", enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("registers event listeners for default revalidate map", () => {
    renderHook(() => useEventStream({ url: "/api/stream" }));
    const es = MockEventSource.instances[0];
    expect(Object.keys(es.listeners).length).toBeGreaterThan(0);
    expect(es.listeners["anomaly.created"]).toBeDefined();
    expect(es.listeners["stats.updated"]).toBeDefined();
  });

  it("calls onEvent callback when event received", () => {
    const onEvent = vi.fn();
    renderHook(() => useEventStream({ url: "/api/stream", onEvent }));
    const es = MockEventSource.instances[0];

    es.emit("anomaly.created", '{"test":true}');
    expect(onEvent).toHaveBeenCalledWith("anomaly.created", '{"test":true}');
  });

  it("calls onError callback on error", () => {
    const onError = vi.fn();
    renderHook(() => useEventStream({ url: "/api/stream", onError }));
    const es = MockEventSource.instances[0];

    es.triggerError();
    expect(onError).toHaveBeenCalled();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useEventStream({ url: "/api/stream" }));
    const es = MockEventSource.instances[0];

    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it("removes listeners on unmount", () => {
    const { unmount } = renderHook(() => useEventStream({ url: "/api/stream" }));
    const es = MockEventSource.instances[0];

    const listenerCountBefore = Object.values(es.listeners).flat().length;
    expect(listenerCountBefore).toBeGreaterThan(0);

    unmount();
    const listenerCountAfter = Object.values(es.listeners).flat().length;
    expect(listenerCountAfter).toBe(0);
  });

  it("recreates EventSource when URL changes", () => {
    const { rerender } = renderHook(
      ({ url }) => useEventStream({ url }),
      { initialProps: { url: "/api/stream/v1" } },
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(false);

    rerender({ url: "/api/stream/v2" });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances[1].url).toBe("/api/stream/v2");
  });

  it("uses custom revalidate map", () => {
    const customMap = { "custom.event": ["/api/custom"] };
    renderHook(() => useEventStream({ url: "/api/stream", revalidateMap: customMap }));
    const es = MockEventSource.instances[0];

    expect(es.listeners["custom.event"]).toBeDefined();
  });

  it("does not crash when enabled toggles to false", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useEventStream({ url: "/api/stream", enabled }),
      { initialProps: { enabled: true } },
    );

    const es = MockEventSource.instances[0];
    rerender({ enabled: false });
    expect(es.closed).toBe(true);
  });
});
