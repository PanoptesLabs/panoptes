import { NextRequest } from "next/server";
import {
  authenticateWorkspace,
  type WorkspaceContext,
} from "@/lib/workspace-auth";

export interface GraphQLContext {
  workspace: WorkspaceContext | null;
}

export async function createContext(
  request: NextRequest,
): Promise<GraphQLContext> {
  const workspace = await authenticateWorkspace(request);
  return { workspace };
}
