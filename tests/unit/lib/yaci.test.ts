import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("yaci", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
