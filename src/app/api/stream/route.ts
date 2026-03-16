import { NextRequest, NextResponse } from "next/server";
import { verifyStreamToken } from "@/lib/stream-token";
import { createSSEStream, resolveInitialSeq, SSE_HEADERS } from "@/lib/sse-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing token query parameter" },
      { status: 401 },
    );
  }

  const result = verifyStreamToken(token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const workspaceId = result.workspaceId;

  const channelsParam = request.nextUrl.searchParams.get("channels");
  const channels = channelsParam
    ? channelsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : null;

  const baseFilter: Record<string, unknown> = {
    OR: [
      { visibility: "public" },
      { visibility: "workspace", workspaceId },
    ],
  };
  if (channels) {
    baseFilter.channel = { in: channels };
  }

  const initialSeq = await resolveInitialSeq(request, baseFilter);
  const stream = createSSEStream(request, baseFilter, initialSeq);

  return new Response(stream, { headers: SSE_HEADERS });
}
