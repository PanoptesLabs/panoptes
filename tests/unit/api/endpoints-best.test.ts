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

vi.mock("@/lib/validation", () => ({
  parseStringParam: vi.fn(),
}));

vi.mock("@/lib/intelligence", () => ({
  selectBestEndpoint: vi.fn(),
}));

import { parseStringParam } from "@/lib/validation";
import { selectBestEndpoint } from "@/lib/intelligence";

const mockEndpoint = (id: string, url: string, type: string) => ({
  id,
  url,
  type,
  provider: null,
  isOfficial: false,
  latestCheck: null,
  stats24h: { uptimePercent: 99, avgLatency: 50, checkCount: 100, errorCount: 1 },
  score: null,
});

describe("GET /api/endpoints/best", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns best RPC endpoint by default", async () => {
    vi.mocked(parseStringParam).mockReturnValue("rpc");
    vi.mocked(selectBestEndpoint).mockResolvedValue({
      endpoint: mockEndpoint("ep-1", "https://rpc.example.com", "rpc"),
      alternatives: [],
      strategy: "score_weighted",
    });

    const { GET } = await import("@/app/api/endpoints/best/route");
    const req = new NextRequest("http://localhost/api/endpoints/best");
    const res = await GET(req);
    const body = await res.json();

    expect(body.endpoint).toBeDefined();
    expect(body.endpoint.type).toBe("rpc");
    expect(body.strategy).toBe("score_weighted");
    expect(selectBestEndpoint).toHaveBeenCalledWith("rpc");
  });

  it("returns best REST endpoint when type=rest", async () => {
    vi.mocked(parseStringParam).mockReturnValue("rest");
    vi.mocked(selectBestEndpoint).mockResolvedValue({
      endpoint: mockEndpoint("ep-2", "https://rest.example.com", "rest"),
      alternatives: [],
      strategy: "score_weighted",
    });

    const { GET } = await import("@/app/api/endpoints/best/route");
    const req = new NextRequest("http://localhost/api/endpoints/best?type=rest");
    const res = await GET(req);
    const body = await res.json();

    expect(body.endpoint.type).toBe("rest");
    expect(selectBestEndpoint).toHaveBeenCalledWith("rest");
  });

  it("includes alternatives in response", async () => {
    vi.mocked(parseStringParam).mockReturnValue("rpc");
    vi.mocked(selectBestEndpoint).mockResolvedValue({
      endpoint: mockEndpoint("ep-1", "https://rpc1.example.com", "rpc"),
      alternatives: [mockEndpoint("ep-2", "https://rpc2.example.com", "rpc")],
      strategy: "score_weighted",
    });

    const { GET } = await import("@/app/api/endpoints/best/route");
    const req = new NextRequest("http://localhost/api/endpoints/best?type=rpc");
    const res = await GET(req);
    const body = await res.json();

    expect(body.alternatives).toHaveLength(1);
    expect(body.alternatives[0].url).toBe("https://rpc2.example.com");
  });

  it("returns fallback strategy when no scores available", async () => {
    vi.mocked(parseStringParam).mockReturnValue("rpc");
    vi.mocked(selectBestEndpoint).mockResolvedValue({
      endpoint: mockEndpoint("ep-1", "https://rpc.example.com", "rpc"),
      alternatives: [],
      strategy: "fallback",
    });

    const { GET } = await import("@/app/api/endpoints/best/route");
    const req = new NextRequest("http://localhost/api/endpoints/best");
    const res = await GET(req);
    const body = await res.json();

    expect(body.strategy).toBe("fallback");
  });

  it("validates type parameter correctly", async () => {
    vi.mocked(parseStringParam).mockReturnValue("rpc");
    vi.mocked(selectBestEndpoint).mockResolvedValue({
      endpoint: mockEndpoint("ep-1", "https://rpc.example.com", "rpc"),
      alternatives: [],
      strategy: "score_weighted",
    });

    const { GET } = await import("@/app/api/endpoints/best/route");
    const req = new NextRequest("http://localhost/api/endpoints/best?type=invalid");
    await GET(req);

    expect(parseStringParam).toHaveBeenCalledWith(
      "invalid",
      ["rpc", "rest", "evm-rpc"],
    );
  });
});
