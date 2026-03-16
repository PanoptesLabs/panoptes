import { prisma } from "@/lib/db";

export const anomalyResolvers = {
  Query: {
    anomalies: async (
      _: unknown,
      args: { resolved?: boolean; limit?: number; offset?: number },
    ) => {
      const where: Record<string, unknown> = {};
      if (args.resolved !== undefined && args.resolved !== null) {
        where.resolved = args.resolved;
      }

      const [items, total] = await Promise.all([
        prisma.anomaly.findMany({
          where,
          orderBy: { detectedAt: "desc" },
          take: Math.min(Math.max(1, args.limit ?? 50), 200),
          skip: Math.max(0, args.offset ?? 0),
        }),
        prisma.anomaly.count({ where }),
      ]);

      return {
        items: items.map((a) => ({
          ...a,
          detectedAt: a.detectedAt.toISOString(),
          resolvedAt: a.resolvedAt?.toISOString() ?? null,
        })),
        total,
      };
    },
  },
};
