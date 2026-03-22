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
}));

import useSWR from "swr";
import { useApiKeys, useApiKeyUsage } from "@/hooks/use-api-keys";

describe("useApiKeys", () => {
  it("calls SWR with /api/keys", () => {
    useApiKeys();
    expect(useSWR).toHaveBeenCalledWith("/api/keys", expect.any(Object));
  });
});

describe("useApiKeyUsage", () => {
  it("calls SWR with key ID URL", () => {
    useApiKeyUsage("key-123");
    expect(useSWR).toHaveBeenCalledWith("/api/keys/key-123/usage", expect.any(Object));
  });

  it("passes null when no keyId", () => {
    useApiKeyUsage(null);
    expect(useSWR).toHaveBeenCalledWith(null, expect.any(Object));
  });
});
