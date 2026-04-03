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
    it("verifies a jail_risk forecast where validator IS jailed (wasAccurate=true)", async () => {
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

    it("verifies a jail_risk forecast where validator is NOT jailed (wasAccurate=false when predicted high risk)", async () => {
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

    it("verifies a latency forecast within threshold (wasAccurate=true)", async () => {
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

    it("verifies a latency forecast outside threshold (wasAccurate=false)", async () => {
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

    it("marks forecast as verified with no accuracy data when entity not found (actualValue=null)", async () => {
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

    it("handles empty expired list (returns verified=0, accurate=0)", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([]);

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(0);
      expect(result.accurate).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.forecast.update).not.toHaveBeenCalled();
    });

    it("verifies downtime metric using endpoint health check", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-6", entityType: "endpoint", entityId: "ep-3", metric: "downtime", predictedValue: 0.9 },
      ]);
      mockPrisma.endpointHealth.findFirst.mockResolvedValue({ isHealthy: false });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-6" },
        data: {
          actualValue: 1.0,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("verifies unbonding metric using validator status", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-7", metric: "unbonding", predictedValue: 0.8 },
      ]);
      mockPrisma.validator.findUnique.mockResolvedValue({ status: "BOND_STATUS_UNBONDING" });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-7" },
        data: {
          actualValue: 1.0,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it("verifies breach_risk metric using SLO breach status", async () => {
      mockPrisma.forecast.findMany.mockResolvedValue([
        { ...baseForecast, id: "fc-8", entityType: "endpoint", entityId: "ep-4", metric: "breach_risk", predictedValue: 0.7 },
      ]);
      mockPrisma.slo.findFirst.mockResolvedValue({ isBreaching: true });

      const result = await verifyExpiredForecasts();

      expect(result.verified).toBe(1);
      expect(result.accurate).toBe(1);
      expect(mockPrisma.forecast.update).toHaveBeenCalledWith({
        where: { id: "fc-8" },
        data: {
          actualValue: 1.0,
          wasAccurate: true,
          verifiedAt: expect.any(Date),
        },
      });
    });
  });
});
