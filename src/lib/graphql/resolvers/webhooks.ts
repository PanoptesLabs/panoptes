import { GraphQLError } from "graphql";
import { prisma } from "@/lib/db";
import { validateWebhookCreate } from "@/lib/webhook-validation";
import { encryptSecret, generateWebhookSecret } from "@/lib/webhook-crypto";
import { WEBHOOK_DEFAULTS } from "@/lib/constants";
import type { GraphQLContext } from "../context";

export const webhookResolvers = {
  Query: {
    webhooks: async (_: unknown, _args: unknown, context: GraphQLContext) => {
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

      const webhooks = await prisma.webhook.findMany({
        where: { workspaceId: context.workspace.id },
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return webhooks.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
      }));
    },
  },
  Mutation: {
    createWebhook: async (
      _: unknown,
      args: { input: { name: string; url: string; events: string[] } },
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

      const validated = validateWebhookCreate(args.input);
      if ("error" in validated) {
        throw new GraphQLError(validated.error, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const plainSecret = generateWebhookSecret();
      const secretEncrypted = encryptSecret(plainSecret);

      const webhook = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${context.workspace!.id} FOR UPDATE`;
        const count = await tx.webhook.count({
          where: { workspaceId: context.workspace!.id },
        });
        if (count >= WEBHOOK_DEFAULTS.MAX_PER_WORKSPACE) {
          throw new GraphQLError(
            `Workspace webhook limit reached (max ${WEBHOOK_DEFAULTS.MAX_PER_WORKSPACE})`,
            { extensions: { code: "LIMIT_EXCEEDED" } },
          );
        }
        return tx.webhook.create({
          data: {
            workspaceId: context.workspace!.id,
            name: validated.name,
            url: validated.url,
            events: validated.events,
            secretEncrypted,
          },
          select: {
            id: true,
            name: true,
            url: true,
            events: true,
            isActive: true,
            createdAt: true,
          },
        });
      });

      return {
        ...webhook,
        createdAt: webhook.createdAt.toISOString(),
      };
    },
    deleteWebhook: async (
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

      const existing = await prisma.webhook.findFirst({
        where: { id: args.id, workspaceId: context.workspace.id },
      });
      if (!existing) {
        throw new GraphQLError("Webhook not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      await prisma.webhook.delete({ where: { id: args.id } });
      return true;
    },
  },
};
