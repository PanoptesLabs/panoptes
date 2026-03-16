import { describe, it, expect } from "vitest";
import {
  validateIncidentUpdate,
  validateIncidentComment,
} from "@/lib/incident-validation";

describe("validateIncidentUpdate", () => {
  it("returns validated status for acknowledged", () => {
    const result = validateIncidentUpdate({ status: "acknowledged" });
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.status).toBe("acknowledged");
  });

  it("returns validated status for resolved", () => {
    const result = validateIncidentUpdate({ status: "resolved" });
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.status).toBe("resolved");
  });

  it("rejects null body", () => {
    expect("error" in validateIncidentUpdate(null)).toBe(true);
  });

  it("rejects missing status", () => {
    expect("error" in validateIncidentUpdate({})).toBe(true);
  });

  it("rejects invalid status value", () => {
    const result = validateIncidentUpdate({ status: "open" });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("status must be one of");
  });
});

describe("validateIncidentComment", () => {
  it("returns trimmed message for valid input", () => {
    const result = validateIncidentComment({ message: "  test comment  " });
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.message).toBe("test comment");
  });

  it("rejects null body", () => {
    expect("error" in validateIncidentComment(null)).toBe(true);
  });

  it("rejects missing message", () => {
    expect("error" in validateIncidentComment({})).toBe(true);
  });

  it("rejects whitespace-only message", () => {
    expect("error" in validateIncidentComment({ message: "   " })).toBe(true);
  });

  it("rejects message over 2000 chars", () => {
    const result = validateIncidentComment({ message: "x".repeat(2001) });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("2000");
  });
});
