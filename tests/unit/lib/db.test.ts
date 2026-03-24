import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

describe("db", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
  });

  it("exports a prisma proxy object", async () => {
    const { prisma } = await import("@/lib/db");
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe("object");
  });

  it("lazily initializes PrismaClient on first access", async () => {
    const { PrismaClient } = await import("@/generated/prisma/client");
    const { prisma } = await import("@/lib/db");

    // Access a property to trigger proxy
    try {
      void (prisma as unknown as Record<string, unknown>).$connect;
    } catch {
      // May throw since mock is minimal
    }

    expect(PrismaClient).toHaveBeenCalled();
  });

  it("throws when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;

    const { prisma } = await import("@/lib/db");

    expect(() => {
      void (prisma as unknown as Record<string, unknown>).$connect;
    }).toThrow("DATABASE_URL");
  });
});
