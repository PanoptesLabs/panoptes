import { describe, it, expect } from "vitest";
import {
  getScoreClasses,
  getBudgetClasses,
  PREDICTION_CONFIG,
  SEVERITY_ICON_COLORS,
} from "@/lib/color-utils";

describe("color-utils", () => {
  describe("getScoreClasses", () => {
    it("returns slate for null", () => {
      expect(getScoreClasses(null)).toContain("slate");
    });

    it("returns teal for score >= 80", () => {
      expect(getScoreClasses(80)).toContain("teal");
      expect(getScoreClasses(100)).toContain("teal");
    });

    it("returns amber for score >= 60", () => {
      expect(getScoreClasses(60)).toContain("amber");
      expect(getScoreClasses(79)).toContain("amber");
    });

    it("returns orange for score >= 40", () => {
      expect(getScoreClasses(40)).toContain("orange");
      expect(getScoreClasses(59)).toContain("orange");
    });

    it("returns rose for score < 40", () => {
      expect(getScoreClasses(0)).toContain("rose");
      expect(getScoreClasses(39)).toContain("rose");
    });
  });

  describe("getBudgetClasses", () => {
    it("returns slate for null", () => {
      expect(getBudgetClasses(null)).toContain("slate");
    });

    it("returns rose for >= 100", () => {
      expect(getBudgetClasses(100)).toContain("rose");
      expect(getBudgetClasses(150)).toContain("rose");
    });

    it("returns amber for >= 80", () => {
      expect(getBudgetClasses(80)).toContain("amber");
      expect(getBudgetClasses(99)).toContain("amber");
    });

    it("returns teal for < 80", () => {
      expect(getBudgetClasses(0)).toContain("teal");
      expect(getBudgetClasses(79)).toContain("teal");
    });
  });

  describe("PREDICTION_CONFIG", () => {
    it("has normal, warning, critical entries", () => {
      expect(PREDICTION_CONFIG.normal.label).toBe("Normal");
      expect(PREDICTION_CONFIG.warning.label).toBe("Warning");
      expect(PREDICTION_CONFIG.critical.label).toBe("Critical");
    });

    it("normal uses teal", () => {
      expect(PREDICTION_CONFIG.normal.classes).toContain("teal");
    });

    it("critical uses rose", () => {
      expect(PREDICTION_CONFIG.critical.classes).toContain("rose");
    });
  });

  describe("SEVERITY_ICON_COLORS", () => {
    it("has all severity levels", () => {
      expect(SEVERITY_ICON_COLORS.critical).toContain("rose");
      expect(SEVERITY_ICON_COLORS.high).toContain("amber");
      expect(SEVERITY_ICON_COLORS.medium).toContain("orange");
      expect(SEVERITY_ICON_COLORS.low).toContain("dusty-lavender");
    });
  });
});
