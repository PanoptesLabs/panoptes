import { describe, it, expect } from "vitest";
import { helpContent } from "@/lib/help-content";

describe("helpContent", () => {
  it("has expected category count", () => {
    const topLevelKeys = Object.keys(helpContent);
    expect(topLevelKeys.length).toBeGreaterThanOrEqual(10);
  });

  it("policies.conditionFields has 14 keys", () => {
    expect(Object.keys(helpContent.policies.conditionFields).length).toBe(14);
  });

  it("policies.operators has 7 keys", () => {
    expect(Object.keys(helpContent.policies.operators).length).toBe(7);
  });

  it("policies.actionTypes has 5 keys", () => {
    expect(Object.keys(helpContent.policies.actionTypes).length).toBe(5);
  });

  it("policies.concepts has 3 keys", () => {
    expect(Object.keys(helpContent.policies.concepts).length).toBe(3);
  });

  it("anomalies.types has 6 keys", () => {
    expect(Object.keys(helpContent.anomalies.types).length).toBe(6);
  });

  it("anomalies.severities has 4 keys", () => {
    expect(Object.keys(helpContent.anomalies.severities).length).toBe(4);
  });

  it("slos.indicators has 4 keys", () => {
    expect(Object.keys(helpContent.slos.indicators).length).toBe(4);
  });

  it("slos.concepts has 4 keys", () => {
    expect(Object.keys(helpContent.slos.concepts).length).toBe(4);
  });

  it("leaderboard.categories has 7 keys", () => {
    expect(Object.keys(helpContent.leaderboard.categories).length).toBe(7);
  });

  it("validators.fields has 5 keys", () => {
    expect(Object.keys(helpContent.validators.fields).length).toBe(5);
  });

  it("validators.statuses has 3 keys", () => {
    expect(Object.keys(helpContent.validators.statuses).length).toBe(3);
  });

  it("apiKeys has 3 keys", () => {
    expect(Object.keys(helpContent.apiKeys).length).toBe(3);
  });

  it("no empty string values in any category", () => {
    function checkNoEmptyStrings(obj: Record<string, unknown>, path: string) {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = `${path}.${key}`;
        if (typeof value === "string") {
          expect(value.trim().length, `${fullPath} should not be empty`).toBeGreaterThan(0);
        } else if (typeof value === "object" && value !== null) {
          checkNoEmptyStrings(value as Record<string, unknown>, fullPath);
        }
      }
    }
    checkNoEmptyStrings(helpContent as unknown as Record<string, unknown>, "helpContent");
  });

  it("forecasts.metrics has 5 keys", () => {
    expect(Object.keys(helpContent.forecasts.metrics).length).toBe(5);
  });

  it("forecasts.concepts has 3 keys", () => {
    expect(Object.keys(helpContent.forecasts.concepts).length).toBe(3);
  });

  it("webhooks.concepts has 4 keys", () => {
    expect(Object.keys(helpContent.webhooks.concepts).length).toBe(4);
  });

  it("endpoints.fields has 4 keys", () => {
    expect(Object.keys(helpContent.endpoints.fields).length).toBe(4);
  });

  it("incidents.statuses has 3 keys", () => {
    expect(Object.keys(helpContent.incidents.statuses).length).toBe(3);
  });

  it("delegations has fields and types", () => {
    expect(Object.keys(helpContent.delegations.fields).length).toBe(1);
    expect(Object.keys(helpContent.delegations.types).length).toBe(4);
  });

  it("network.fields has 10 keys", () => {
    expect(Object.keys(helpContent.network.fields).length).toBe(10);
  });
});
