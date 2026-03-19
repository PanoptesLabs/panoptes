import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/auth";

export interface GraphQLContext {
  workspace: { id: string; name: string; slug: string } | null;
}

export async function createContext(
  request: NextRequest,
): Promise<GraphQLContext> {
  const auth = await resolveAuth(request);
  return { workspace: auth?.workspace ?? null };
}
