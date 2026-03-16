import { prisma } from "@/lib/db";

export const validatorResolvers = {
  Query: {
    validators: async (
      _: unknown,
      args: { status?: string; limit?: number; offset?: number },
    ) => {
      const where = args.status ? { status: args.status } : {};
      const [items, total] = await Promise.all([
        prisma.validator.findMany({
          where,
          take: Math.min(Math.max(1, args.limit ?? 50), 200),
          skip: Math.max(0, args.offset ?? 0),
          orderBy: { lastUpdated: "desc" },
        }),
        prisma.validator.count({ where }),
      ]);
      return {
        items: items.map((v) => ({
          ...v,
          firstSeen: v.firstSeen.toISOString(),
          lastUpdated: v.lastUpdated.toISOString(),
        })),
        total,
      };
    },
    validator: async (_: unknown, args: { id: string }) => {
      const v = await prisma.validator.findUnique({ where: { id: args.id } });
      if (!v) return null;
      return {
        ...v,
        firstSeen: v.firstSeen.toISOString(),
        lastUpdated: v.lastUpdated.toISOString(),
      };
    },
  },
};
