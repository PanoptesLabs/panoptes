import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("republic-sdk", () => {
  class MockRepublicClient {
    rpc: string;
    rest: string;
    opts: Record<string, unknown>;
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
      this.rpc = opts.rpc as string;
      this.rest = opts.rest as string;
    }
  }
  return {
    RepublicClient: MockRepublicClient,
    REPUBLIC_TESTNET: {
      chainId: "raitestnet_77701-1",
      rpc: "https://rpc.republicai.io",
      rest: "https://rest.republicai.io",
    },
  };
});

describe("getRepublicClient", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.REPUBLIC_RPC_URL;
    delete process.env.REPUBLIC_REST_URL;
    // Clear cached client on globalThis so each test gets a fresh instance
    const g = globalThis as unknown as Record<string, unknown>;
    delete g.republicClient;
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it("creates client with default URLs", async () => {
    const { getRepublicClient } = await import("@/lib/republic");
    const client = getRepublicClient();
    expect(client).toBeDefined();
    expect((client as unknown as Record<string, string>).rpc).toBe("https://rpc.republicai.io");
  });

  it("uses env var overrides", async () => {
    process.env.REPUBLIC_RPC_URL = "https://custom-rpc.example.com";
    process.env.REPUBLIC_REST_URL = "https://custom-rest.example.com";
    const { getRepublicClient } = await import("@/lib/republic");
    const client = getRepublicClient();
    expect((client as unknown as Record<string, string>).rpc).toBe("https://custom-rpc.example.com");
    expect((client as unknown as Record<string, string>).rest).toBe("https://custom-rest.example.com");
  });

  it("caches client in non-production mode", async () => {
    env.NODE_ENV = "development";
    const { getRepublicClient } = await import("@/lib/republic");
    const a = getRepublicClient();
    const b = getRepublicClient();
    expect(a).toBe(b);
  });

  it("creates new client each time in production", async () => {
    env.NODE_ENV = "production";
    const { getRepublicClient } = await import("@/lib/republic");
    const a = getRepublicClient();
    const b = getRepublicClient();
    expect(a).not.toBe(b);
  });
});
