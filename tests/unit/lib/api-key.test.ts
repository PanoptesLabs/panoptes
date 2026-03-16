import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    apiKeyUsageCounter: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  authenticateApiKey,
  incrementAndCheckQuota,
  getApiKeyUsage,
} from "@/lib/api-key";

describe("generateApiKey", () => {
  it("generates key with pk_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^pk_[a-f0-9]{64}$/);
  });

  it("generates unique keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe("hashApiKey", () => {
  it("returns consistent sha256 hash", () => {
    const key = "pk_test123";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("returns different hashes for different keys", () => {
    const hash1 = hashApiKey("pk_key1");
    const hash2 = hashApiKey("pk_key2");
    expect(hash1).not.toBe(hash2);
  });
});

describe("getKeyPrefix", () => {
  it("returns first 12 characters", () => {
    const key = "pk_abcdef1234567890";
    expect(getKeyPrefix(key)).toBe("pk_abcdef123");
  });
});

describe("authenticateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for unknown key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);
    const result = await authenticateApiKey("pk_unknown");
    expect(result).toBeNull();
  });

  it("returns null for inactive key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key1",
      isActive: false,
      workspace: { id: "ws1", name: "Test", slug: "test", isActive: true },
      tier: "free",
      rateLimit: 60,
      workspaceId: "ws1",
      expiresAt: null,
    } as never);
    const result = await authenticateApiKey("pk_test");
    expect(result).toBeNull();
  });

  it("returns null for inactive workspace", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key1",
      isActive: true,
      workspace: { id: "ws1", name: "Test", slug: "test", isActive: false },
      tier: "free",
      rateLimit: 60,
      workspaceId: "ws1",
      expiresAt: null,
    } as never);
    const result = await authenticateApiKey("pk_test");
    expect(result).toBeNull();
  });

  it("returns null for expired key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key1",
      isActive: true,
      workspace: { id: "ws1", name: "Test", slug: "test", isActive: true },
      tier: "free",
      rateLimit: 60,
      workspaceId: "ws1",
      expiresAt: new Date("2020-01-01"),
    } as never);
    const result = await authenticateApiKey("pk_test");
    expect(result).toBeNull();
  });

  it("returns context for valid key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key1",
      isActive: true,
      workspace: { id: "ws1", name: "Test WS", slug: "test-ws", isActive: true },
      tier: "free",
      rateLimit: 60,
      workspaceId: "ws1",
      expiresAt: null,
    } as never);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never);

    const result = await authenticateApiKey("pk_valid");
    expect(result).toEqual({
      id: "key1",
      workspaceId: "ws1",
      tier: "free",
      rateLimit: 60,
      workspace: { id: "ws1", name: "Test WS", slug: "test-ws" },
    });
  });
});

describe("incrementAndCheckQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when within quota", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ count: 5 }]);
    const result = await incrementAndCheckQuota("key1", "2026-03-15", "daily", 1000);
    expect(result).toBe(true);
  });

  it("returns false when quota exceeded", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await incrementAndCheckQuota("key1", "2026-03-15", "daily", 1000);
    expect(result).toBe(false);
  });

  it("returns true when quota is 0 (unlimited)", async () => {
    const result = await incrementAndCheckQuota("key1", "2026-03-15", "daily", 0);
    expect(result).toBe(true);
  });
});

describe("getApiKeyUsage", () => {
  it("returns categorized usage data", async () => {
    vi.mocked(prisma.apiKeyUsageCounter.findMany).mockResolvedValue([
      { id: "1", apiKeyId: "key1", period: "2026-03-15", periodType: "daily", count: 42, updatedAt: new Date() },
      { id: "2", apiKeyId: "key1", period: "2026-03", periodType: "monthly", count: 500, updatedAt: new Date() },
    ] as never);

    const usage = await getApiKeyUsage("key1");
    expect(usage.daily).toHaveLength(1);
    expect(usage.daily[0].count).toBe(42);
    expect(usage.monthly).toHaveLength(1);
    expect(usage.monthly[0].count).toBe(500);
  });
});
