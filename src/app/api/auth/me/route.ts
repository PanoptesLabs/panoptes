import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, rateLimitForRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  if (!auth || auth.role === ROLES.ANONYMOUS) {
    return NextResponse.json(
      { user: null, role: ROLES.ANONYMOUS },
      { headers: rl.headers },
    );
  }

  return NextResponse.json(
    {
      user: auth.user,
      role: auth.role,
      workspace: { id: auth.workspace.id, name: auth.workspace.name, slug: auth.workspace.slug },
    },
    { headers: rl.headers },
  );
}
