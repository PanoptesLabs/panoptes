import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/intelligence/policy-conditions", () => ({
  ALLOWED_FIELDS: new Set([
    "anomaly.type",
    "anomaly.severity",
    "anomaly.entityType",
    "endpoint.score",
    "endpoint.uptime",
    "endpoint.latency",
    "endpoint.isHealthy",
    "validator.score",
    "validator.jailed",
    "validator.missedBlocks",
    "validator.commission",
    "slo.isBreaching",
    "slo.budgetConsumed",
    "slo.currentValue",
  ]),
}));

import {
  validateConditions,
  validateActions,
  validateCooldown,
  validatePolicyCreate,
  safeParseJSON,
} from "@/lib/policy-validation";

describe("validateConditions", () => {
  it("returns null for valid conditions", () => {
    const result = validateConditions([
      { field: "anomaly.type", operator: "eq", value: "jailing" },
    ]);
    expect(result).toBeNull();
  });

  it("rejects empty conditions", () => {
    expect(validateConditions([])).toContain("At least one condition");
  });

  it("rejects too many conditions", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      field: "anomaly.type",
      operator: "eq",
      value: `v${i}`,
    }));
    expect(validateConditions(many)).toContain("Maximum");
  });

  it("rejects condition without field", () => {
    expect(validateConditions([{ operator: "eq", value: "x" }])).toContain("field");
  });

  it("rejects condition without operator", () => {
    expect(validateConditions([{ field: "anomaly.type", value: "x" }])).toContain("operator");
  });

  it("rejects condition without value", () => {
    expect(validateConditions([{ field: "anomaly.type", operator: "eq" }])).toContain("value");
  });

  it("rejects invalid operator", () => {
    expect(validateConditions([{ field: "anomaly.type", operator: "invalid", value: "x" }])).toContain("Invalid operator");
  });

  it("rejects invalid field", () => {
    expect(validateConditions([{ field: "not.valid", operator: "eq", value: "x" }])).toContain("Invalid condition field");
  });

  it("accepts all valid operators", () => {
    for (const op of ["eq", "neq", "gt", "gte", "lt", "lte", "in"]) {
      expect(validateConditions([{ field: "anomaly.type", operator: op, value: "x" }])).toBeNull();
    }
  });

  it("rejects null condition in array", () => {
    expect(validateConditions([null])).not.toBeNull();
  });
});

describe("validateActions", () => {
  it("returns null for valid actions", () => {
    expect(validateActions([{ type: "log" }])).toBeNull();
  });

  it("rejects empty actions", () => {
    expect(validateActions([])).toContain("At least one action");
  });

  it("rejects too many actions", () => {
    const many = Array.from({ length: 6 }, () => ({ type: "log" }));
    expect(validateActions(many)).toContain("Maximum");
  });

  it("rejects invalid action type", () => {
    expect(validateActions([{ type: "invalid" }])).toContain("Invalid action type");
  });

  it("accepts all valid action types", () => {
    for (const type of ["webhook", "routing_exclude", "log", "annotate", "incident_create"]) {
      expect(validateActions([{ type }])).toBeNull();
    }
  });

  it("rejects null action", () => {
    expect(validateActions([null])).not.toBeNull();
  });
});

describe("validateCooldown", () => {
  it("returns null for valid cooldown", () => {
    expect(validateCooldown(60)).toBeNull();
  });

  it("rejects cooldown below minimum", () => {
    expect(validateCooldown(0)).toContain("Cooldown");
  });

  it("rejects cooldown above maximum", () => {
    expect(validateCooldown(2000)).toContain("Cooldown");
  });

  it("accepts minimum cooldown", () => {
    expect(validateCooldown(1)).toBeNull();
  });

  it("accepts maximum cooldown", () => {
    expect(validateCooldown(1440)).toBeNull();
  });
});

describe("validatePolicyCreate", () => {
  const validBody = {
    name: "Test Policy",
    conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
    actions: [{ type: "log" }],
  };

  it("returns validated body for valid input", () => {
    const result = validatePolicyCreate(validBody);
    expect(result).not.toHaveProperty("error");
    expect(result).toHaveProperty("name", "Test Policy");
  });

  it("rejects null body", () => {
    expect(validatePolicyCreate(null)).toHaveProperty("error");
  });

  it("rejects non-object body", () => {
    expect(validatePolicyCreate("string")).toHaveProperty("error");
  });

  it("rejects short name", () => {
    expect(validatePolicyCreate({ ...validBody, name: "a" })).toHaveProperty("error");
  });

  it("rejects missing conditions", () => {
    expect(validatePolicyCreate({ ...validBody, conditions: undefined })).toHaveProperty("error");
  });

  it("rejects missing actions", () => {
    expect(validatePolicyCreate({ ...validBody, actions: undefined })).toHaveProperty("error");
  });

  it("trims name and description", () => {
    const result = validatePolicyCreate({
      ...validBody,
      name: "  Trimmed  ",
      description: "  Desc  ",
    });
    expect(result).toHaveProperty("name", "Trimmed");
    expect(result).toHaveProperty("description", "Desc");
  });

  it("handles optional fields", () => {
    const result = validatePolicyCreate({
      ...validBody,
      dryRun: true,
      priority: 5,
      cooldownMinutes: 60,
    });
    expect(result).toHaveProperty("dryRun", true);
    expect(result).toHaveProperty("priority", 5);
    expect(result).toHaveProperty("cooldownMinutes", 60);
  });

  it("rejects non-number cooldown", () => {
    expect(validatePolicyCreate({ ...validBody, cooldownMinutes: "abc" })).toHaveProperty("error");
  });
});

describe("safeParseJSON", () => {
  it("parses valid JSON", () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeParseJSON("not json")).toBeNull();
  });

  it("uses custom fallback", () => {
    expect(safeParseJSON("bad", [])).toEqual([]);
  });

  it("parses arrays", () => {
    expect(safeParseJSON("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("parses primitives", () => {
    expect(safeParseJSON("42")).toBe(42);
    expect(safeParseJSON('"hello"')).toBe("hello");
    expect(safeParseJSON("true")).toBe(true);
    expect(safeParseJSON("null")).toBeNull();
  });
});
