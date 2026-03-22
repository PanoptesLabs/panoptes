import { describe, it, expect, vi } from "vitest";

vi.mock("swr", () => ({
  default: vi.fn((url: string | null) => ({
    data: null,
    error: null,
    isLoading: true,
    mutate: vi.fn(),
    _url: url,
  })),
}));

vi.mock("@/hooks/use-api", () => ({
  sessionSwrConfig: { fetcher: vi.fn() },
  sessionMutate: vi.fn().mockResolvedValue({}),
}));

import useSWR from "swr";
import { useWebhooks, useWebhookDetail, createWebhook, deleteWebhook } from "@/hooks/use-webhooks";
import { sessionMutate } from "@/hooks/use-api";

describe("useWebhooks", () => {
  it("calls SWR with /api/webhooks", () => {
    useWebhooks();
    expect(useSWR).toHaveBeenCalledWith("/api/webhooks", expect.any(Object));
  });
});

describe("useWebhookDetail", () => {
  it("calls SWR with webhook ID URL", () => {
    useWebhookDetail("wh-1");
    expect(useSWR).toHaveBeenCalledWith("/api/webhooks/wh-1", expect.any(Object));
  });

  it("passes null when no id", () => {
    useWebhookDetail(null);
    expect(useSWR).toHaveBeenCalledWith(null, expect.any(Object));
  });
});

describe("createWebhook", () => {
  it("calls sessionMutate with POST", async () => {
    await createWebhook({ name: "Test", url: "https://example.com", events: ["anomaly.created"] });
    expect(sessionMutate).toHaveBeenCalledWith("/api/webhooks", "POST", expect.objectContaining({ name: "Test" }));
  });
});

describe("deleteWebhook", () => {
  it("calls sessionMutate with DELETE", async () => {
    await deleteWebhook("wh-1");
    expect(sessionMutate).toHaveBeenCalledWith("/api/webhooks/wh-1", "DELETE");
  });
});
