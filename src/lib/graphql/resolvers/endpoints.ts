import { prisma } from "@/lib/db";

export const endpointResolvers = {
  Query: {
    endpoints: async (_: unknown, args: { type?: string }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (args.type) where.type = args.type;

      const endpoints = await prisma.endpoint.findMany({ where });

      return endpoints.map((ep) => ({
        id: ep.id,
        url: ep.url,
        type: ep.type,
        provider: ep.provider,
        isOfficial: ep.isOfficial,
        isActive: ep.isActive,
        score: null,
      }));
    },
    bestEndpoint: async (_: unknown, args: { type: string }) => {
      const endpoints = await prisma.endpoint.findMany({
        where: { type: args.type, isActive: true },
        include: {
          scores: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      });

      if (endpoints.length === 0) return null;

      let best = endpoints[0];
      for (const ep of endpoints) {
        const bestScore = best.scores[0]?.score ?? 0;
        const epScore = ep.scores[0]?.score ?? 0;
        if (epScore > bestScore) best = ep;
      }

      return {
        id: best.id,
        url: best.url,
        type: best.type,
        provider: best.provider,
        isOfficial: best.isOfficial,
        isActive: best.isActive,
        score: best.scores[0]?.score ?? null,
      };
    },
  },
};
