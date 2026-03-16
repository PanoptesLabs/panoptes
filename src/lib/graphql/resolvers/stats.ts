import { prisma } from "@/lib/db";

export const statsResolvers = {
  Query: {
    networkStats: async () => {
      const stats = await prisma.networkStats.findFirst({
        orderBy: { timestamp: "desc" },
      });
      if (!stats) return null;
      return {
        totalValidators: stats.totalValidators,
        activeValidators: stats.activeValidators,
        totalStaked: stats.totalStaked,
        blockHeight: stats.blockHeight.toString(),
        avgBlockTime: stats.avgBlockTime,
        timestamp: stats.timestamp.toISOString(),
      };
    },
  },
};
