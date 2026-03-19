import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

import {
  hashToken,
  extractApiKey,
} from "@/lib/workspace-auth";

describe("hashToken", () => {
  it("returns consistent SHA-256 hex digest", () => {
    const hash1 = hashToken("test-token");
    const hash2 = hashToken("test-token");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hash for different tokens", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("returns 64-char hex string", () => {
    const hash = hashToken("any-token");
    expect(hash).toHaveLength(64);
  });
});

describe("extractApiKey", () => {
  it("extracts key from x-api-key header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "ws_my-api-key" },
    });
    expect(extractApiKey(req)).toBe("ws_my-api-key");
  });

  it("returns null when no x-api-key header", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(extractApiKey(req)).toBeNull();
  });

  it("returns null for empty x-api-key value", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "  " },
    });
    expect(extractApiKey(req)).toBeNull();
  });

  it("trims whitespace from key", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "  ws_my-key  " },
    });
    expect(extractApiKey(req)).toBe("ws_my-key");
  });
});
