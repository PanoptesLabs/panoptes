import { describe, it, expect } from "vitest";
import { validateSloCreate, validateSloUpdate } from "@/lib/slo-validation";

describe("validateSloCreate", () => {
  const validInput = {
    name: "Uptime SLO",
    indicator: "uptime",
    entityType: "endpoint",
    entityId: "ep-1",
    target: 0.99,
    windowDays: 7,
  };

  it("returns validated result for valid input", () => {
    const result = validateSloCreate(validInput);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.name).toBe("Uptime SLO");
      expect(result.indicator).toBe("uptime");
    }
  });

  it("trims name whitespace", () => {
    const result = validateSloCreate({ ...validInput, name: "  Test  " });
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.name).toBe("Test");
  });

  it("rejects null body", () => {
    const result = validateSloCreate(null);
    expect("error" in result).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateSloCreate({ ...validInput, name: "" });
    expect("error" in result).toBe(true);
  });

  it("rejects name over 100 chars", () => {
    const result = validateSloCreate({ ...validInput, name: "x".repeat(101) });
    expect("error" in result).toBe(true);
  });

  it("rejects invalid indicator", () => {
    const result = validateSloCreate({ ...validInput, indicator: "invalid" });
    expect("error" in result).toBe(true);
  });

  it("rejects invalid entityType", () => {
    const result = validateSloCreate({ ...validInput, entityType: "unknown" });
    expect("error" in result).toBe(true);
  });

  it("rejects indicator-entityType mismatch", () => {
    const result = validateSloCreate({
      ...validInput,
      indicator: "block_production",
      entityType: "endpoint",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("not compatible");
  });

  it("rejects target below 0.9", () => {
    const result = validateSloCreate({ ...validInput, target: 0.5 });
    expect("error" in result).toBe(true);
  });

  it("rejects target above 0.9999", () => {
    const result = validateSloCreate({ ...validInput, target: 1.0 });
    expect("error" in result).toBe(true);
  });

  it("rejects non-integer windowDays", () => {
    const result = validateSloCreate({ ...validInput, windowDays: 3.5 });
    expect("error" in result).toBe(true);
  });

  it("rejects windowDays outside 1-7 range", () => {
    expect("error" in validateSloCreate({ ...validInput, windowDays: 0 })).toBe(true);
    expect("error" in validateSloCreate({ ...validInput, windowDays: 8 })).toBe(true);
  });
});

describe("validateSloUpdate", () => {
  it("returns validated result for valid partial update", () => {
    const result = validateSloUpdate({ name: "Updated", isActive: false });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.name).toBe("Updated");
      expect(result.isActive).toBe(false);
    }
  });

  it("rejects null body", () => {
    expect("error" in validateSloUpdate(null)).toBe(true);
  });

  it("rejects empty body (no fields)", () => {
    const result = validateSloUpdate({});
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("At least one field");
  });

  it("rejects empty name", () => {
    expect("error" in validateSloUpdate({ name: "" })).toBe(true);
  });

  it("rejects non-boolean isActive", () => {
    expect("error" in validateSloUpdate({ isActive: "true" })).toBe(true);
  });

  it("rejects target out of range", () => {
    expect("error" in validateSloUpdate({ target: 0.5 })).toBe(true);
  });
});
