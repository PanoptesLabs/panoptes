import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("yaci", () => {
  const originalEnv = process.env.YACI_EXPLORER_BASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.YACI_EXPLORER_BASE_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.YACI_EXPLORER_BASE_URL = originalEnv;
    } else {
      delete process.env.YACI_EXPLORER_BASE_URL;
    }
  });

  describe("fetchYaci", () => {
    it("returns ok:true with parsed JSON on success", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total_jobs: 100 }),
      }));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci<{ total_jobs: number }>("/compute_stats");

      expect(result).toEqual({ ok: true, data: { total_jobs: 100 } });
    });

    it("returns ok:false with error:'http' on non-ok response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/compute_stats");

      expect(result).toEqual({ ok: false, error: "http" });
    });

    it("returns ok:false with error:'network' on fetch failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/compute_stats");

      expect(result).toEqual({ ok: false, error: "network" });
    });

    it("returns ok:false with error:'timeout' on AbortError", async () => {
      const abortErr = new DOMException("Aborted", "AbortError");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/compute_stats");

      expect(result).toEqual({ ok: false, error: "timeout" });
    });

    it("returns ok:false with error:'timeout' on TimeoutError (Node ≥18)", async () => {
      const timeoutErr = new DOMException("Signal timed out", "TimeoutError");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/compute_stats");

      expect(result).toEqual({ ok: false, error: "timeout" });
    });

    it("uses custom base URL from YACI_EXPLORER_BASE_URL env", async () => {
      process.env.YACI_EXPLORER_BASE_URL = "https://custom-yaci.example.com";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: true }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { fetchYaci } = await import("@/lib/yaci");
      await fetchYaci("/test-path");

      expect(mockFetch.mock.calls[0][0]).toBe("https://custom-yaci.example.com/test-path");
    });

    it("uses default base URL when env is not set", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: true }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { fetchYaci } = await import("@/lib/yaci");
      await fetchYaci("/test-path");

      expect(mockFetch.mock.calls[0][0]).toBe("https://yaci-explorer-apis.fly.dev/test-path");
    });

    it("returns ok:false with error:'parse' when schema validation fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ unexpected: "data" }),
      }));

      const schema = z.object({ total_jobs: z.number() });
      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/test", { schema });

      expect(result).toEqual({ ok: false, error: "parse" });
    });

    it("validates data with schema when provided", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total_jobs: 42 }),
      }));

      const schema = z.object({ total_jobs: z.number() });
      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/test", { schema });

      expect(result).toEqual({ ok: true, data: { total_jobs: 42 } });
    });

    it("returns ok:false with error:'parse' on invalid JSON", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      }));

      const { fetchYaci } = await import("@/lib/yaci");
      const result = await fetchYaci("/compute_stats");

      expect(result).toEqual({ ok: false, error: "parse" });
    });
  });

  describe("parseModelName", () => {
    it("maps known images to display names", async () => {
      const { parseModelName } = await import("@/lib/yaci");

      expect(parseModelName("republicai/gpt2-inference:latest")).toBe("GPT-2");
      expect(parseModelName("republicai/llama2-inference:v1")).toBe("LLaMA 2");
      expect(parseModelName("republicai/mistral-inference:latest")).toBe("Mistral");
      expect(parseModelName("republic-llm-inference:latest")).toBe("Republic LLM");
    });

    it("falls back to title-cased base name for unknown images", async () => {
      const { parseModelName } = await import("@/lib/yaci");

      expect(parseModelName("myorg/custom-model-inference:v2")).toBe("Custom Model");
      expect(parseModelName("some-thing:latest")).toBe("Some Thing");
    });
  });
});
