import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const webhookModel = {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
  return {
    prisma: {
      validator: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      endpoint: {
        findMany: vi.fn(),
      },
      networkStats: {
        findFirst: vi.fn(),
      },
      anomaly: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      slo: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      incident: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      webhook: webhookModel,
      governanceProposal: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return fn({
          $queryRaw: vi.fn(),
          webhook: webhookModel,
        });
      }),
    },
  };
});

vi.mock("@/lib/webhook-validation", () => ({
  validateWebhookCreate: vi.fn((input: Record<string, unknown>) => {
    if (!input.name || !input.url || !input.events) {
      return { error: "Validation failed" };
    }
    return { name: input.name, url: input.url, events: input.events };
  }),
}));

vi.mock("@/lib/webhook-crypto", () => ({
  generateWebhookSecret: vi.fn(() => "whsec_" + "ab".repeat(32)),
  encryptSecret: vi.fn(() => "encrypted-secret-base64"),
}));

import { prisma } from "@/lib/db";
import { validatorResolvers } from "@/lib/graphql/resolvers/validators";
import { endpointResolvers } from "@/lib/graphql/resolvers/endpoints";
import { statsResolvers } from "@/lib/graphql/resolvers/stats";
import { anomalyResolvers } from "@/lib/graphql/resolvers/anomalies";
import { sloResolvers } from "@/lib/graphql/resolvers/slos";
import { incidentResolvers } from "@/lib/graphql/resolvers/incidents";
import { webhookResolvers } from "@/lib/graphql/resolvers/webhooks";
import { governanceResolvers } from "@/lib/graphql/resolvers/governance";
import type { GraphQLContext } from "@/lib/graphql/context";

const mockWorkspaceCtx: GraphQLContext = {
  workspace: { id: "ws-1", name: "Test", slug: "test" },
};
const noAuthCtx: GraphQLContext = { workspace: null };

const now = new Date("2026-01-15T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Validators ──────────────────────────────────────────────────────────────

describe("validators resolver", () => {
  it("returns paginated validator list", async () => {
    const mockValidators = [
      {
        id: "val-1",
        moniker: "Node A",
        status: "BOND_STATUS_BONDED",
        tokens: "1000",
        commission: 0.1,
        jailed: false,
        uptime: 99.5,
        votingPower: "100",
        missedBlocks: 2,
        jailCount: 0,
        lastJailedAt: null,
        firstSeen: now,
        lastUpdated: now,
      },
    ];
    vi.mocked(prisma.validator.findMany).mockResolvedValue(mockValidators as never);
    vi.mocked(prisma.validator.count).mockResolvedValue(1);

    const result = await validatorResolvers.Query.validators({}, { limit: 10, offset: 0 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].moniker).toBe("Node A");
    expect(result.items[0].firstSeen).toBe("2026-01-15T12:00:00.000Z");
  });

  it("filters by status", async () => {
    vi.mocked(prisma.validator.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.validator.count).mockResolvedValue(0);

    await validatorResolvers.Query.validators({}, { status: "BOND_STATUS_BONDED" });

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "BOND_STATUS_BONDED" },
      }),
    );
  });
});

describe("validator resolver", () => {
  it("returns single validator by id", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue({
      id: "val-1",
      moniker: "Node A",
      status: "BOND_STATUS_BONDED",
      tokens: "1000",
      commission: 0.1,
      jailed: false,
      uptime: 99.5,
      votingPower: "100",
      missedBlocks: 2,
      jailCount: 0,
      lastJailedAt: null,
      firstSeen: now,
      lastUpdated: now,
    } as never);

    const result = await validatorResolvers.Query.validator({}, { id: "val-1" });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("val-1");
    expect(result!.lastUpdated).toBe("2026-01-15T12:00:00.000Z");
  });

  it("returns null for missing validator", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue(null);

    const result = await validatorResolvers.Query.validator({}, { id: "missing" });
    expect(result).toBeNull();
  });
});

// ── Endpoints ───────────────────────────────────────────────────────────────

describe("endpoints resolver", () => {
  it("returns endpoint list", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([
      {
        id: "ep-1",
        url: "https://rpc.example.com",
        type: "rpc",
        provider: "Test",
        isOfficial: true,
        isActive: true,
        createdAt: now,
      },
    ] as never);

    const result = await endpointResolvers.Query.endpoints({}, {});
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://rpc.example.com");
  });

  it("filters by type", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([] as never);

    await endpointResolvers.Query.endpoints({}, { type: "rest" });

    expect(prisma.endpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "rest" }),
      }),
    );
  });
});

describe("bestEndpoint resolver", () => {
  it("returns best endpoint by score", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([
      {
        id: "ep-1",
        url: "https://rpc1.example.com",
        type: "rpc",
        provider: "A",
        isOfficial: true,
        isActive: true,
        scores: [{ score: 0.8, timestamp: now }],
      },
      {
        id: "ep-2",
        url: "https://rpc2.example.com",
        type: "rpc",
        provider: "B",
        isOfficial: false,
        isActive: true,
        scores: [{ score: 0.95, timestamp: now }],
      },
    ] as never);

    const result = await endpointResolvers.Query.bestEndpoint({}, { type: "rpc" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("ep-2");
    expect(result!.score).toBe(0.95);
  });

  it("returns null when no endpoints found", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([] as never);

    const result = await endpointResolvers.Query.bestEndpoint({}, { type: "rpc" });
    expect(result).toBeNull();
  });
});

// ── Stats ───────────────────────────────────────────────────────────────────

describe("networkStats resolver", () => {
  it("returns latest network stats", async () => {
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      id: "stats-1",
      totalValidators: 50,
      activeValidators: 40,
      totalStaked: "1000000",
      bondedRatio: 0.65,
      blockHeight: BigInt(12345),
      avgBlockTime: 5.2,
      timestamp: now,
    } as never);

    const result = await statsResolvers.Query.networkStats();

    expect(result).not.toBeNull();
    expect(result!.totalValidators).toBe(50);
    expect(result!.blockHeight).toBe("12345");
    expect(result!.timestamp).toBe("2026-01-15T12:00:00.000Z");
  });

  it("returns null when no stats exist", async () => {
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue(null);

    const result = await statsResolvers.Query.networkStats();
    expect(result).toBeNull();
  });
});

// ── Anomalies ───────────────────────────────────────────────────────────────

describe("anomalies resolver", () => {
  it("returns anomaly connection with pagination", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "an-1",
        type: "jailing",
        severity: "high",
        entityType: "validator",
        entityId: "val-1",
        title: "Validator jailed",
        description: "Jailed for missing blocks",
        metadata: null,
        resolved: false,
        detectedAt: now,
        resolvedAt: null,
      },
    ] as never);
    vi.mocked(prisma.anomaly.count).mockResolvedValue(1);

    const result = await anomalyResolvers.Query.anomalies({}, { limit: 10, offset: 0 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].detectedAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("filters by resolved status", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.anomaly.count).mockResolvedValue(0);

    await anomalyResolvers.Query.anomalies({}, { resolved: false });

    expect(prisma.anomaly.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resolved: false },
      }),
    );
  });
});

// ── SLOs ────────────────────────────────────────────────────────────────────

describe("slos resolver", () => {
  it("requires workspace authentication", async () => {
    await expect(
      sloResolvers.Query.slos({}, {}, noAuthCtx),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns slos for authenticated workspace", async () => {
    vi.mocked(prisma.slo.findMany).mockResolvedValue([
      {
        id: "slo-1",
        workspaceId: "ws-1",
        name: "Uptime SLO",
        indicator: "uptime",
        entityType: "endpoint",
        entityId: "ep-1",
        target: 0.99,
        windowDays: 7,
        isActive: true,
        isBreaching: false,
        currentValue: 0.995,
        budgetConsumed: 0.5,
        burnRate: null,
        lastEvaluatedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ] as never);

    const result = await sloResolvers.Query.slos({}, {}, mockWorkspaceCtx);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Uptime SLO");
  });
});

describe("createSlo mutation", () => {
  it("requires workspace authentication", async () => {
    await expect(
      sloResolvers.Mutation.createSlo(
        {},
        {
          input: {
            name: "Test",
            indicator: "uptime",
            entityType: "endpoint",
            entityId: "ep-1",
            target: 0.99,
            windowDays: 7,
          },
        },
        noAuthCtx,
      ),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("deleteSlo mutation", () => {
  it("requires workspace authentication", async () => {
    await expect(
      sloResolvers.Mutation.deleteSlo({}, { id: "slo-1" }, noAuthCtx),
    ).rejects.toThrow("Unauthorized");
  });
});

// ── Incidents ───────────────────────────────────────────────────────────────

describe("incidents resolver", () => {
  it("requires workspace authentication", async () => {
    await expect(
      incidentResolvers.Query.incidents({}, {}, noAuthCtx),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns incidents for authenticated workspace", async () => {
    vi.mocked(prisma.incident.findMany).mockResolvedValue([
      {
        id: "inc-1",
        workspaceId: "ws-1",
        entityType: "endpoint",
        entityId: "ep-1",
        status: "open",
        severity: "high",
        title: "Endpoint down",
        description: "Endpoint not responding",
        detectedAt: now,
        acknowledgedAt: null,
        resolvedAt: null,
      },
    ] as never);
    vi.mocked(prisma.incident.count).mockResolvedValue(1);

    const result = await incidentResolvers.Query.incidents(
      {},
      { limit: 10 },
      mockWorkspaceCtx,
    );

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].detectedAt).toBe("2026-01-15T12:00:00.000Z");
  });
});

// ── Webhooks ────────────────────────────────────────────────────────────────

describe("webhooks resolver", () => {
  it("requires workspace authentication", async () => {
    await expect(
      webhookResolvers.Query.webhooks({}, {}, noAuthCtx),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns webhooks for authenticated workspace", async () => {
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "wh-1",
        name: "My Webhook",
        url: "https://example.com/hook",
        events: ["anomaly.created"],
        isActive: true,
        createdAt: now,
      },
    ] as never);

    const result = await webhookResolvers.Query.webhooks({}, {}, mockWorkspaceCtx);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe("2026-01-15T12:00:00.000Z");
  });
});

describe("createWebhook mutation", () => {
  it("requires workspace authentication", async () => {
    await expect(
      webhookResolvers.Mutation.createWebhook(
        {},
        { input: { name: "Test", url: "https://example.com", events: ["anomaly.created"] } },
        noAuthCtx,
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("creates webhook for authenticated workspace", async () => {
    vi.mocked(prisma.webhook.count).mockResolvedValue(0);
    vi.mocked(prisma.webhook.create).mockResolvedValue({
      id: "wh-new",
      name: "Test Webhook",
      url: "https://example.com/hook",
      events: ["anomaly.created"],
      isActive: true,
      createdAt: now,
    } as never);

    const result = await webhookResolvers.Mutation.createWebhook(
      {},
      { input: { name: "Test Webhook", url: "https://example.com/hook", events: ["anomaly.created"] } },
      mockWorkspaceCtx,
    );

    expect(result.id).toBe("wh-new");
    expect(result.createdAt).toBe("2026-01-15T12:00:00.000Z");
  });
});

describe("deleteWebhook mutation", () => {
  it("requires workspace authentication", async () => {
    await expect(
      webhookResolvers.Mutation.deleteWebhook({}, { id: "wh-1" }, noAuthCtx),
    ).rejects.toThrow("Unauthorized");
  });
});

// ── Governance ──────────────────────────────────────────────────────────────

describe("governanceProposals resolver", () => {
  it("returns proposal list", async () => {
    vi.mocked(prisma.governanceProposal.findMany).mockResolvedValue([
      {
        id: "prop-1",
        title: "Upgrade v2",
        status: "PROPOSAL_STATUS_VOTING_PERIOD",
        proposer: "rai1abc...",
        submitTime: now,
        votingStartTime: now,
        votingEndTime: new Date("2026-01-22T12:00:00Z"),
      },
    ] as never);

    const result = await governanceResolvers.Query.governanceProposals({}, {});
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Upgrade v2");
    expect(result[0].submitTime).toBe("2026-01-15T12:00:00.000Z");
  });

  it("filters by status", async () => {
    vi.mocked(prisma.governanceProposal.findMany).mockResolvedValue([] as never);

    await governanceResolvers.Query.governanceProposals(
      {},
      { status: "PROPOSAL_STATUS_PASSED" },
    );

    expect(prisma.governanceProposal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PROPOSAL_STATUS_PASSED" },
      }),
    );
  });
});
