import { GraphQLError } from "graphql";
import { prisma } from "@/lib/db";
import type { GraphQLContext } from "../context";

export const sloResolvers = {
  Query: {
    slos: async (_: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.workspace) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const slos = await prisma.slo.findMany({
        where: { workspaceId: context.workspace.id },
        orderBy: { createdAt: "desc" },
      });

      return slos;
    },
  },
  Mutation: {
    createSlo: async (
      _: unknown,
      args: {
        input: {
          name: string;
          indicator: string;
          entityType: string;
          entityId: string;
          target: number;
          windowDays: number;
        };
      },
      context: GraphQLContext,
    ) => {
      if (!context.workspace) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const { input } = args;
      if (typeof input.target !== "number" || input.target < 0 || input.target > 1) {
        throw new GraphQLError("Target must be between 0 and 1", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (typeof input.windowDays !== "number" || input.windowDays < 1 || input.windowDays > 365) {
        throw new GraphQLError("Window days must be between 1 and 365", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const slo = await prisma.slo.create({
        data: {
          workspaceId: context.workspace.id,
          name: args.input.name,
          indicator: args.input.indicator,
          entityType: args.input.entityType,
          entityId: args.input.entityId,
          target: args.input.target,
          windowDays: args.input.windowDays,
        },
      });

      return slo;
    },
    deleteSlo: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      if (!context.workspace) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const slo = await prisma.slo.findFirst({
        where: { id: args.id, workspaceId: context.workspace.id },
      });
      if (!slo) {
        throw new GraphQLError("SLO not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      await prisma.slo.delete({ where: { id: args.id } });
      return true;
    },
  },
};
