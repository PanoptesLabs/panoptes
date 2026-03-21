import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-helpers";
import { createSSEStream, resolveInitialSeq, SSE_HEADERS, acquireStream } from "@/lib/sse-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!acquireStream(ip)) {
    return NextResponse.json(
      { error: "Too many concurrent streams" },
      { status: 429 },
    );
  }

  const channelsParam = request.nextUrl.searchParams.get("channels");
  const channels = channelsParam
    ? channelsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : null;

  const baseFilter: Record<string, unknown> = { visibility: "public" };
  if (channels) {
    baseFilter.channel = { in: channels };
  }

  const initialSeq = await resolveInitialSeq(request, baseFilter);
  const stream = createSSEStream(request, baseFilter, initialSeq);

  return new Response(stream, { headers: SSE_HEADERS });
}
