import { GraphQLError } from "graphql";
import { prisma } from "@/lib/db";
import { validateSloCreate } from "@/lib/slo-validation";
import { SLO_DEFAULTS } from "@/lib/constants";
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

      if (context.role === "viewer" || context.role === "anonymous") {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const validated = validateSloCreate(args.input);
      if ("error" in validated) {
        throw new GraphQLError(validated.error, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Entity existence check
      if (validated.entityType === "endpoint") {
        const endpoint = await prisma.endpoint.findUnique({
          where: { id: validated.entityId },
          select: { id: true },
        });
        if (!endpoint) {
          throw new GraphQLError("Endpoint not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
      } else {
        const validator = await prisma.validator.findUnique({
          where: { id: validated.entityId },
          select: { id: true },
        });
        if (!validator) {
          throw new GraphQLError("Validator not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
      }

      // Workspace limit check with transaction
      const slo = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${context.workspace!.id} FOR UPDATE`;
        const count = await tx.slo.count({
          where: { workspaceId: context.workspace!.id },
        });
        if (count >= SLO_DEFAULTS.MAX_PER_WORKSPACE) {
          return null;
        }
        return tx.slo.create({
          data: {
            workspaceId: context.workspace!.id,
            name: validated.name,
            indicator: validated.indicator,
            entityType: validated.entityType,
            entityId: validated.entityId,
            target: validated.target,
            windowDays: validated.windowDays,
          },
        });
      });

      if (!slo) {
        throw new GraphQLError(
          `Workspace SLO limit reached (max ${SLO_DEFAULTS.MAX_PER_WORKSPACE})`,
          { extensions: { code: "LIMIT_EXCEEDED" } },
        );
      }

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

      if (context.role === "viewer" || context.role === "anonymous") {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
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
