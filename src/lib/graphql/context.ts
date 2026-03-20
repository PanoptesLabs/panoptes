import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/auth";
import type { Role } from "@/lib/constants";

export interface GraphQLContext {
  workspace: { id: string; name: string; slug: string } | null;
  user: { id: string; address: string } | null;
  role: Role;
}

export async function createContext(
  request: NextRequest,
): Promise<GraphQLContext> {
  const auth = await resolveAuth(request);
  return {
    workspace: auth?.workspace ?? null,
    user: auth?.user ?? null,
    role: auth?.role ?? "anonymous",
  };
}
