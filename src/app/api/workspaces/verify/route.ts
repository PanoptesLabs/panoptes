import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-helpers";
import { authenticateWorkspace } from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const workspace = await authenticateWorkspace(request);

  if (!workspace) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: rl.headers },
    );
  }

  return NextResponse.json(
    { workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } },
    { headers: rl.headers },
  );
}
