import { prisma } from "@/lib/db";

export const governanceResolvers = {
  Query: {
    governanceProposals: async (
      _: unknown,
      args: { status?: string; limit?: number },
    ) => {
      const where = args.status ? { status: args.status } : {};

      const proposals = await prisma.governanceProposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(args.limit ?? 20, 100),
        select: {
          id: true,
          title: true,
          status: true,
          proposer: true,
          submitTime: true,
          votingStartTime: true,
          votingEndTime: true,
        },
      });

      return proposals.map((p) => ({
        ...p,
        submitTime: p.submitTime?.toISOString() ?? null,
        votingStartTime: p.votingStartTime?.toISOString() ?? null,
        votingEndTime: p.votingEndTime?.toISOString() ?? null,
      }));
    },
  },
};
