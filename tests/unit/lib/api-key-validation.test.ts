import { describe, it, expect } from "vitest";
import { validateApiKeyCreate } from "@/lib/api-key-validation";

describe("validateApiKeyCreate", () => {
  it("returns error for null body", () => {
    const result = validateApiKeyCreate(null);
    expect(result).toHaveProperty("error");
  });

  it("returns error for missing name", () => {
    const result = validateApiKeyCreate({});
    expect(result).toHaveProperty("error");
  });

  it("returns error for empty name", () => {
    const result = validateApiKeyCreate({ name: "" });
    expect(result).toHaveProperty("error");
  });

  it("returns error for name too long", () => {
    const result = validateApiKeyCreate({ name: "a".repeat(101) });
    expect(result).toHaveProperty("error");
  });

  it("returns error for invalid tier", () => {
    const result = validateApiKeyCreate({ name: "test", tier: "enterprise" });
    expect(result).toHaveProperty("error");
  });

  it("returns error for invalid expiresAt", () => {
    const result = validateApiKeyCreate({ name: "test", expiresAt: "not-a-date" });
    expect(result).toHaveProperty("error");
  });

  it("returns error for past expiresAt", () => {
    const result = validateApiKeyCreate({ name: "test", expiresAt: "2020-01-01" });
    expect(result).toHaveProperty("error");
  });

  it("validates successfully with name only", () => {
    const result = validateApiKeyCreate({ name: "My Key" });
    expect(result).not.toHaveProperty("error");
    expect(result).toEqual({
      name: "My Key",
      tier: "free",
      expiresAt: null,
    });
  });

  it("validates with explicit tier", () => {
    const result = validateApiKeyCreate({ name: "test", tier: "pro" });
    expect(result).not.toHaveProperty("error");
    if (!("error" in result)) {
      expect(result.tier).toBe("pro");
    }
  });

  it("validates with future expiresAt", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = validateApiKeyCreate({ name: "test", expiresAt: future.toISOString() });
    expect(result).not.toHaveProperty("error");
    if (!("error" in result)) {
      expect(result.expiresAt).toBeInstanceOf(Date);
    }
  });

  it("trims name whitespace", () => {
    const result = validateApiKeyCreate({ name: "  test key  " });
    expect(result).not.toHaveProperty("error");
    if (!("error" in result)) {
      expect(result.name).toBe("test key");
    }
  });
});
