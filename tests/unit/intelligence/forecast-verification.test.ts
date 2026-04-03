import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    forecast: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    validator: {
      findUnique: vi.fn(),
    },
    endpointHealth: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    delegationSnapshot: {
      findMany: vi.fn(),
    },
    slo: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { verifyExpiredForecasts } from "@/lib/intelligence/forecast-verification";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const baseForecast = {
  id: "fc-1",
  entityType: "validator",
  entityId: "raivaloper1abc",
  metric: "jail_risk",
  prediction: "warning",
  confidence: 0.8,
  timeHorizon: "24h",
  currentValue: 0.3,
  predictedValue: 0.7,
  threshold: null,
  reasoning: "test",
  validUntil: new Date("2025-01-01"),
  actualValue: null,
  wasAccurate: null,
  verifiedAt: null,
  createdAt: new Date(),
};

describe("forecast-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.forecast.update.mockResolvedValue({});
  });

  describe("verifyExpiredForecasts", () => {
    // ─── jail_risk: direction-based (predictedValue is missedBlockRate 0-1, actual is 0/1 jailed) ───

    it("jail_risk: accurate when predicted high and validator IS jailed", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, predictedValue: 0.8 },
      ]);
      mockPrisma.validator.findUnique.mockResolvedValue({ jailed: true });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-1" },
        data: {
          actualValue: 1.0,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("jail_risk: inaccurate when predicted high but validator NOT jailed", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-2", predictedValue: 0.9 },
      ]);
      mockPrisma.validator.findUnique.mockResolvedValue({ jailed: false });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-2" },
        data: {
          actualValue: 0.0,
          wasAccurate: false,
          verifiedAt: expect.any(Date),
        },
      });
    });

    // ─── latency: value-deviation (both sides in ms) ───

    it("latency: accurate when actual within 30% of predicted", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-3", entityType: "endpoint", entityId: "ep-1", metric: "latency", predictedValue: 120 },
      ]);
      mockPrisma.endpointHealth.findFirst.mockResolvedValue({ latencyMs: 110 });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-3" },
        data: {
          actualValue: 110,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("latency: inaccurate when actual far from predicted", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-4", entityType: "endpoint", entityId: "ep-2", metric: "latency", predictedValue: 100 },
      ]);
      mockPrisma.endpointHealth.findFirst.mockResolvedValue({ latencyMs: 200 });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-4" },
        data: {
          actualValue: 200,
          wasAccurate: false,
          verifiedAt: expect.any(Date),
        },
      });
    });

    // ─── downtime: value-deviation (both sides in failure rate %) ───
    // Generator writes: failureRate * 100 (percentage)
    // Verifier computes: (failedChecks / totalChecks) * 100

    it("downtime: accurate when actual failure rate matches predicted", async () => {
      // Generator predicted 60% failure rate
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-6", entityType: "endpoint", entityId: "ep-3", metric: "downtime", predictedValue: 60 },
      ]);
      // 6 out of 10 checks failed → actual = 60%
      mockPrisma.endpointHealth.findMany.mockResolvedValue([
        { isHealthy: false }, { isHealthy: false }, { isHealthy: false },
        { isHealthy: false }, { isHealthy: false }, { isHealthy: false },
        { isHealthy: true }, { isHealthy: true }, { isHealthy: true }, { isHealthy: true },
      ]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-6" },
        data: {
          actualValue: 60,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("downtime: inaccurate when actual failure rate deviates from predicted", async () => {
      // Generator predicted 20% failure rate
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-6b", entityType: "endpoint", entityId: "ep-3b", metric: "downtime", predictedValue: 20 },
      ]);
      // 8 out of 10 checks failed → actual = 80%
      mockPrisma.endpointHealth.findMany.mockResolvedValue([
        { isHealthy: false }, { isHealthy: false }, { isHealthy: false }, { isHealthy: false },
        { isHealthy: false }, { isHealthy: false }, { isHealthy: false }, { isHealthy: false },
        { isHealthy: true }, { isHealthy: true },
      ]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
    });

    // ─── unbonding: value-deviation (both sides in delegation change %) ───
    // Generator writes: changePct = ((last - first) / first) * 100
    // Verifier computes the same from delegation snapshots

    it("unbonding: accurate when actual delegation change matches predicted", async () => {
      // Generator predicted -15% delegation change
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-7", metric: "unbonding", predictedValue: -15 },
      ]);
      // Snapshots: 1000 → 850 = -15% change
      mockPrisma.delegationSnapshot.findMany.mockResolvedValue([
        { totalDelegated: "1000" },
        { totalDelegated: "850" },
      ]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-7" },
        data: {
          actualValue: -15,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("unbonding: inaccurate when actual delegation change deviates from predicted", async () => {
      // Generator predicted -5% delegation change
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-7b", metric: "unbonding", predictedValue: -5 },
      ]);
      // Snapshots: 1000 → 700 = -30% change (far from -5%)
      mockPrisma.delegationSnapshot.findMany.mockResolvedValue([
        { totalDelegated: "1000" },
        { totalDelegated: "700" },
      ]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
    });

    it("unbonding: null when fewer than 2 snapshots", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-7c", metric: "unbonding", predictedValue: -10 },
      ]);
      mockPrisma.delegationSnapshot.findMany.mockResolvedValue([
        { totalDelegated: "1000" },
      ]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      // No accuracy data — only verifiedAt
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-7c" },
        data: { verifiedAt: expect.any(Date) },
      });
    });

    // ─── breach_risk: value-deviation (both sides in budget consumption %) ───
    // Generator writes: currentBudget + slope * 6 (projected %)
    // Verifier gets actual budgetConsumed from latest SLO evaluation

    it("breach_risk: accurate when actual budget consumption matches prediction", async () => {
      // Generator predicted 78% budget consumption
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-8", entityType: "endpoint", entityId: "ep-4", metric: "breach_risk", predictedValue: 78 },
      ]);
      // Actual budget consumed: 75%
      mockPrisma.slo.findFirst.mockResolvedValue({
        evaluations: [{ budgetConsumed: 75 }],
      });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-8" },
        data: {
          actualValue: 75,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("breach_risk: inaccurate when actual budget far from prediction", async () => {
      // Generator predicted 30% budget consumption
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-8b", entityType: "endpoint", entityId: "ep-4b", metric: "breach_risk", predictedValue: 30 },
      ]);
      // Actual budget consumed: 90%
      mockPrisma.slo.findFirst.mockResolvedValue({
        evaluations: [{ budgetConsumed: 90 }],
      });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
    });

    // ─── Edge cases ───

    it("marks forecast as verified with no accuracy data when entity not found", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-5" },
      ]);
      mockPrisma.validator.findUnique.mockResolvedValue(null);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-5" },
        data: { verifiedAt: expect.any(Date) },
      });
    });

    it("handles empty expired list", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(0);
      expect(result.accurate).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.forecast.update).not.toHaveBeenCalled();
    });

    it("downtime: null when no health checks found", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-9", entityType: "endpoint", entityId: "ep-missing", metric: "downtime", predictedValue: 50 },
      ]);
      mockPrisma.endpointHealth.findMany.mockResolvedValue([]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-9" },
        data: { verifiedAt: expect.any(Date) },
      });
    });

    it("breach_risk: null when SLO has no evaluations", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-10", entityType: "endpoint", entityId: "ep-5", metric: "breach_risk", predictedValue: 50 },
      ]);
      mockPrisma.slo.findFirst.mockResolvedValue({ evaluations: [] });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(0);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-10" },
        data: { verifiedAt: expect.any(Date) },
      });
    });
  });
});
