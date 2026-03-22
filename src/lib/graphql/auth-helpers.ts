import { GraphQLError } from "graphql";
import type { GraphQLContext } from "./context";

/** Require authenticated workspace. Throws UNAUTHORIZED if missing. */
export function requireAuth(context: GraphQLContext): { id: string; name: string; slug: string } {
  if (!context.workspace) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  return context.workspace;
}

/** Require editor role or higher. Throws UNAUTHORIZED or FORBIDDEN. */
export function requireEditor(context: GraphQLContext): { id: string; name: string; slug: string } {
  const workspace = requireAuth(context);
  if (context.role === "viewer" || context.role === "anonymous") {
    throw new GraphQLError("Insufficient permissions", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return workspace;
}

/** Require admin role. Throws UNAUTHORIZED or FORBIDDEN. */
export function requireAdmin(context: GraphQLContext): { id: string; name: string; slug: string } {
  const workspace = requireAuth(context);
  if (context.role !== "admin") {
    throw new GraphQLError("Insufficient permissions", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return workspace;
}
