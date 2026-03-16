import { GraphQLError } from "graphql";
import { prisma } from "@/lib/db";
import type { GraphQLContext } from "../context";

export const incidentResolvers = {
  Query: {
    incidents: async (
      _: unknown,
      args: { status?: string; limit?: number; offset?: number },
      context: GraphQLContext,
    ) => {
      if (!context.workspace) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const where: Record<string, unknown> = {
        workspaceId: context.workspace.id,
      };
      if (args.status) where.status = args.status;

      const [items, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          orderBy: { detectedAt: "desc" },
          take: Math.min(Math.max(1, args.limit ?? 50), 200),
          skip: Math.max(0, args.offset ?? 0),
        }),
        prisma.incident.count({ where }),
      ]);

      return {
        items: items.map((i) => ({
          ...i,
          detectedAt: i.detectedAt.toISOString(),
          acknowledgedAt: i.acknowledgedAt?.toISOString() ?? null,
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
        })),
        total,
      };
    },
  },
};
