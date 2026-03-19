import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { parseIntParam } from "@/lib/validation";
import { validateIncidentComment } from "@/lib/incident-validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const { id } = await params;

  const incident = await prisma.incident.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    select: { id: true },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "Incident not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseIntParam(searchParams.get("limit"), 100, 1, 500);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);

  const [events, total] = await Promise.all([
    prisma.incidentEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.incidentEvent.count({ where: { incidentId: id } }),
  ]);

  return NextResponse.json(
    { events, total, limit, offset },
    { headers: rl.headers },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const writeError = requireRole(auth, "member", rl.headers);
  if (writeError) return writeError;

  const { id } = await params;

  const incident = await prisma.incident.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    select: { id: true },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "Incident not found" },
      { status: 404, headers: rl.headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const validated = validateIncidentComment(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const event = await prisma.incidentEvent.create({
    data: {
      incidentId: id,
      eventType: "comment",
      message: validated.message,
    },
  });

  return NextResponse.json(event, { status: 201, headers: rl.headers });
}
