import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>) =>
      NextResponse.json(data, { headers }),
    ),
  };
});

vi.mock("@/lib/intelligence", () => ({
  getForecasts: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  parseIntParam: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  FORECAST_DEFAULTS: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
}));

import { getForecasts } from "@/lib/intelligence";
import { parseIntParam } from "@/lib/validation";

const mockForecast = (overrides = {}) => ({
  id: "forecast-1",
  entityType: "endpoint",
  entityId: "ep-1",
  metric: "latency",
  prediction: "warning",
  confidence: 85,
  timeHorizon: "1h",
  currentValue: 3000,
  predictedValue: 7000,
  threshold: 5000,
  reasoning: "Latency projected to increase",
  validUntil: new Date("2026-03-23T00:00:00Z"),
  createdAt: new Date("2026-03-22T00:00:00Z"),
  ...overrides,
});

describe("GET /api/forecasts/[entityType]/[entityId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forecasts for valid endpoint entity", async () => {
    vi.mocked(parseIntParam).mockReturnValue(10);
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [mockForecast()],
      total: 1,
    });

    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/endpoint/ep-1");
    const res = await GET(req, {
      params: Promise.resolve({ entityType: "endpoint", entityId: "ep-1" }),
    });
    const body = await res.json();

    expect(body.forecasts).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.forecasts[0].entityType).toBe("endpoint");
    expect(getForecasts).toHaveBeenCalledWith({
      entityType: "endpoint",
      entityId: "ep-1",
      limit: 10,
    });
  });

  it("returns forecasts for validator entity", async () => {
    vi.mocked(parseIntParam).mockReturnValue(10);
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [],
      total: 0,
    });

    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/validator/raivaloper1abc");
    await GET(req, {
      params: Promise.resolve({ entityType: "validator", entityId: "raivaloper1abc" }),
    });

    expect(getForecasts).toHaveBeenCalledWith({
      entityType: "validator",
      entityId: "raivaloper1abc",
      limit: 10,
    });
  });

  it("returns 400 for invalid entity type", async () => {
    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/invalid/entity-1");
    const res = await GET(req, {
      params: Promise.resolve({ entityType: "invalid", entityId: "entity-1" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid entity type");
  });

  it("formats date fields as ISO strings", async () => {
    vi.mocked(parseIntParam).mockReturnValue(10);
    const validUntil = new Date("2026-03-23T12:00:00Z");
    const createdAt = new Date("2026-03-22T12:00:00Z");

    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [mockForecast({ validUntil, createdAt })],
      total: 1,
    });

    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/endpoint/ep-1");
    const res = await GET(req, {
      params: Promise.resolve({ entityType: "endpoint", entityId: "ep-1" }),
    });
    const body = await res.json();

    expect(body.forecasts[0].validUntil).toBe(validUntil.toISOString());
    expect(body.forecasts[0].createdAt).toBe(createdAt.toISOString());
  });

  it("includes limit in response", async () => {
    vi.mocked(parseIntParam).mockReturnValue(15);
    vi.mocked(getForecasts).mockResolvedValue({
      forecasts: [],
      total: 0,
    });

    const { GET } = await import("@/app/api/forecasts/[entityType]/[entityId]/route");
    const req = new NextRequest("http://localhost/api/forecasts/endpoint/ep-1?limit=15");
    const res = await GET(req, {
      params: Promise.resolve({ entityType: "endpoint", entityId: "ep-1" }),
    });
    const body = await res.json();

    expect(body.limit).toBe(15);
  });
});
