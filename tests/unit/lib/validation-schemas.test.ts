import { describe, it, expect } from "vitest";
import {
  parseBody,
  authVerifySchema,
  webhookCreateSchema,
  webhookUpdateSchema,
  sloCreateSchema,
  sloUpdateSchema,
  apiKeyCreateSchema,
} from "@/lib/validation/index";

describe("Zod validation schemas", () => {
  describe("authVerifySchema", () => {
    it("accepts valid input", () => {
      const result = parseBody(authVerifySchema, {
        address: "rai1abc",
        pubKey: "pub123",
        signature: "sig456",
        sessionId: "sess789",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing fields", () => {
      const result = parseBody(authVerifySchema, { address: "rai1abc" });
      expect(result.success).toBe(false);
    });

    it("rejects empty strings", () => {
      const result = parseBody(authVerifySchema, {
        address: "",
        pubKey: "pub",
        signature: "sig",
        sessionId: "sess",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("webhookCreateSchema", () => {
    const valid = {
      name: "My Webhook",
      url: "https://example.com/webhook",
      events: ["anomaly.created"],
    };

    it("accepts valid input", () => {
      const result = parseBody(webhookCreateSchema, valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("My Webhook");
      }
    });

    it("trims name and url", () => {
      const result = parseBody(webhookCreateSchema, {
        ...valid,
        name: "  trimmed  ",
        url: "  https://example.com  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("trimmed");
        expect(result.data.url).toBe("https://example.com");
      }
    });

    it("rejects empty name", () => {
      const result = parseBody(webhookCreateSchema, { ...valid, name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects name over 100 chars", () => {
      const result = parseBody(webhookCreateSchema, { ...valid, name: "a".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL", () => {
      const result = parseBody(webhookCreateSchema, { ...valid, url: "not-a-url" });
      expect(result.success).toBe(false);
    });

    it("rejects empty events", () => {
      const result = parseBody(webhookCreateSchema, { ...valid, events: [] });
      expect(result.success).toBe(false);
    });

    it("rejects invalid event types", () => {
      const result = parseBody(webhookCreateSchema, { ...valid, events: ["invalid.event"] });
      expect(result.success).toBe(false);
    });
  });

  describe("webhookUpdateSchema", () => {
    it("accepts partial update with name only", () => {
      const result = parseBody(webhookUpdateSchema, { name: "Updated" });
      expect(result.success).toBe(true);
    });

    it("accepts isActive toggle", () => {
      const result = parseBody(webhookUpdateSchema, { isActive: false });
      expect(result.success).toBe(true);
    });

    it("rejects empty object", () => {
      const result = parseBody(webhookUpdateSchema, {});
      expect(result.success).toBe(false);
    });
  });

  describe("sloCreateSchema", () => {
    const valid = {
      name: "Uptime SLO",
      indicator: "uptime",
      entityType: "endpoint",
      entityId: "ep-1",
      target: 0.995,
      windowDays: 7,
    };

    it("accepts valid input", () => {
      const result = parseBody(sloCreateSchema, valid);
      expect(result.success).toBe(true);
    });

    it("rejects target below minimum", () => {
      const result = parseBody(sloCreateSchema, { ...valid, target: 0.5 });
      expect(result.success).toBe(false);
    });

    it("rejects target above maximum", () => {
      const result = parseBody(sloCreateSchema, { ...valid, target: 1.0 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer windowDays", () => {
      const result = parseBody(sloCreateSchema, { ...valid, windowDays: 7.5 });
      expect(result.success).toBe(false);
    });

    it("rejects invalid indicator", () => {
      const result = parseBody(sloCreateSchema, { ...valid, indicator: "invalid" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid entityType", () => {
      const result = parseBody(sloCreateSchema, { ...valid, entityType: "network" });
      expect(result.success).toBe(false);
    });
  });

  describe("sloUpdateSchema", () => {
    it("accepts partial update", () => {
      const result = parseBody(sloUpdateSchema, { name: "Updated SLO" });
      expect(result.success).toBe(true);
    });

    it("accepts isActive toggle", () => {
      const result = parseBody(sloUpdateSchema, { isActive: true });
      expect(result.success).toBe(true);
    });

    it("rejects empty object", () => {
      const result = parseBody(sloUpdateSchema, {});
      expect(result.success).toBe(false);
    });
  });

  describe("apiKeyCreateSchema", () => {
    it("accepts valid input", () => {
      const result = parseBody(apiKeyCreateSchema, { name: "My Key" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("free");
      }
    });

    it("defaults tier to free", () => {
      const result = parseBody(apiKeyCreateSchema, { name: "Key" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("free");
      }
    });

    it("accepts pro tier", () => {
      const result = parseBody(apiKeyCreateSchema, { name: "Pro Key", tier: "pro" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("pro");
      }
    });

    it("rejects name over max length", () => {
      const result = parseBody(apiKeyCreateSchema, { name: "a".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("rejects invalid tier", () => {
      const result = parseBody(apiKeyCreateSchema, { name: "Key", tier: "enterprise" });
      expect(result.success).toBe(false);
    });
  });

  describe("parseBody", () => {
    it("returns first error message on failure", () => {
      const result = parseBody(authVerifySchema, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe("string");
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });
});
