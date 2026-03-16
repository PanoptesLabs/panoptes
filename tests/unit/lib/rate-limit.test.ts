import { describe, it, expect, beforeEach } from "vitest";

// Need to reset module state between tests
let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

describe("checkRateLimit", () => {
  beforeEach(async () => {
    // Re-import to reset the store
    const mod = await import("@/lib/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("decrements remaining on subsequent calls", () => {
    checkRateLimit("192.168.1.2");
    const result = checkRateLimit("192.168.1.2");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(58);
  });

  it("blocks after exceeding limit", () => {
    const ip = "192.168.1.3";
    for (let i = 0; i < 60; i++) {
      checkRateLimit(ip);
    }

    const result = checkRateLimit(ip);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("10.0.0.1");
    }

    const result = checkRateLimit("10.0.0.2");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });
});

describe("checkKeyRateLimit", () => {
  let checkKeyRateLimit: typeof import("@/lib/rate-limit").checkKeyRateLimit;

  beforeEach(async () => {
    const mod = await import("@/lib/rate-limit");
    checkKeyRateLimit = mod.checkKeyRateLimit;
  });

  it("allows requests under key limit", () => {
    const result = checkKeyRateLimit("key-1", 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("blocks after exceeding key limit", () => {
    for (let i = 0; i < 10; i++) {
      checkKeyRateLimit("key-2", 10);
    }
    const result = checkKeyRateLimit("key-2", 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 10; i++) {
      checkKeyRateLimit("key-3", 10);
    }
    const result = checkKeyRateLimit("key-4", 10);
    expect(result.allowed).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  let rateLimitHeaders: typeof import("@/lib/rate-limit").rateLimitHeaders;

  beforeEach(async () => {
    const mod = await import("@/lib/rate-limit");
    rateLimitHeaders = mod.rateLimitHeaders;
  });

  it("returns correct header values", () => {
    const headers = rateLimitHeaders({ remaining: 55, resetAt: 1742000000000 });
    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("55");
    expect(headers["X-RateLimit-Reset"]).toBe("1742000000");
  });

  it("clamps negative remaining to 0", () => {
    const headers = rateLimitHeaders({ remaining: -5, resetAt: Date.now() });
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});
