import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetcher,
  sessionFetcher,
  sessionMutate,
  defaultSwrConfig,
  pollingSwrConfig,
  sessionSwrConfig,
} from "@/hooks/use-api";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetcher", () => {
  it("calls fetch and returns json", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: "ok" }),
    });

    const result = await fetcher("/api/test");

    expect(mockFetch).toHaveBeenCalledWith("/api/test", undefined);
    expect(result).toEqual({ data: "ok" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetcher("/api/test")).rejects.toThrow("API request failed");
  });

  it("attaches status to error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    try {
      await fetcher("/api/test");
    } catch (err) {
      expect((err as Error & { status: number }).status).toBe(500);
    }
  });
});

describe("sessionFetcher", () => {
  it("includes credentials in request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: "test" }),
    });

    const result = await sessionFetcher("/api/session");

    expect(mockFetch).toHaveBeenCalledWith("/api/session", {
      credentials: "include",
    });
    expect(result).toEqual({ user: "test" });
  });
});

describe("sessionMutate", () => {
  it("sends correct method and body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ id: 1 })),
    });

    const result = await sessionMutate("/api/items", "POST", { name: "test" });

    expect(mockFetch).toHaveBeenCalledWith("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "test" }),
    });
    expect(result).toEqual({ id: 1 });
  });

  it("sends PATCH without body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(""),
    });

    await sessionMutate("/api/items/1", "PATCH");

    expect(mockFetch).toHaveBeenCalledWith("/api/items/1", {
      method: "PATCH",
      headers: {},
      credentials: "include",
      body: undefined,
    });
  });

  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(""),
    });

    await sessionMutate("/api/items/1", "DELETE");

    expect(mockFetch).toHaveBeenCalledWith("/api/items/1", {
      method: "DELETE",
      headers: {},
      credentials: "include",
      body: undefined,
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    await expect(
      sessionMutate("/api/items", "POST", { name: "test" }),
    ).rejects.toThrow("POST /api/items failed");
  });
});

describe("SWR config exports", () => {
  it("defaultSwrConfig has expected shape", () => {
    expect(defaultSwrConfig.fetcher).toBe(fetcher);
    expect(defaultSwrConfig.revalidateOnFocus).toBe(false);
    expect(defaultSwrConfig.errorRetryCount).toBe(3);
    expect(defaultSwrConfig.dedupingInterval).toBe(5000);
  });

  it("pollingSwrConfig extends defaultSwrConfig with refreshInterval", () => {
    expect(pollingSwrConfig.fetcher).toBe(fetcher);
    expect(pollingSwrConfig.refreshInterval).toBe(30_000);
  });

  it("sessionSwrConfig uses sessionFetcher", () => {
    expect(sessionSwrConfig.fetcher).toBe(sessionFetcher);
    expect(sessionSwrConfig.revalidateOnFocus).toBe(false);
    expect(sessionSwrConfig.errorRetryCount).toBe(3);
  });
});
