import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("error logs with context prefix", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("test-context", new Error("boom"));
    expect(console.error).toHaveBeenCalledWith(
      "[test-context]",
      expect.anything(),
    );
  });

  it("error logs non-Error objects", async () => {
    const { logger } = await import("@/lib/logger");
    logger.error("ctx", "string error");
    expect(console.error).toHaveBeenCalledWith("[ctx]", "string error");
  });

  it("warn logs with context prefix", async () => {
    const { logger } = await import("@/lib/logger");
    logger.warn("ctx", "warning message");
    expect(console.warn).toHaveBeenCalledWith("[ctx]", "warning message");
  });
});
