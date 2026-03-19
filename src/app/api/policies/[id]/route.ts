import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole, rateLimitForRole } from "@/lib/auth";
import { validateConditions, validateActions, validateCooldown, safeParseJSON } from "@/lib/policy-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const { id } = await ctx.params;

  const policy = await prisma.policy.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
    include: {
      executions: {
        orderBy: { timestamp: "desc" },
        take: 20,
      },
    },
  });

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  return NextResponse.json({
    ...policy,
    conditions: safeParseJSON(policy.conditions, []),
    actions: safeParseJSON(policy.actions, []),
    executions: policy.executions.map((e) => ({
      ...e,
      conditionsMet: safeParseJSON(e.conditionsMet, []),
      actionsTaken: safeParseJSON(e.actionsTaken, []),
      actionsResults: safeParseJSON(e.actionsResults, []),
    })),
  }, { headers: rl.headers });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const writeError = requireRole(auth, "editor", rl.headers);
  if (writeError) return writeError;

  const { id } = await ctx.params;

  const existing = await prisma.policy.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: rl.headers });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: rl.headers });
  }

  const b = body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (typeof b.name === "string") {
    if (b.name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400, headers: rl.headers });
    }
    updateData.name = b.name.trim();
  }
  if (typeof b.description === "string") updateData.description = b.description.trim();
  if (typeof b.isActive === "boolean") updateData.isActive = b.isActive;
  if (typeof b.dryRun === "boolean") updateData.dryRun = b.dryRun;
  if (typeof b.priority === "number") updateData.priority = b.priority;
  if (typeof b.cooldownMinutes === "number") {
    const cdErr = validateCooldown(b.cooldownMinutes);
    if (cdErr) {
      return NextResponse.json({ error: cdErr }, { status: 400, headers: rl.headers });
    }
    updateData.cooldownMinutes = b.cooldownMinutes;
  }

  if (Array.isArray(b.conditions)) {
    const condErr = validateConditions(b.conditions);
    if (condErr) {
      return NextResponse.json({ error: condErr }, { status: 400, headers: rl.headers });
    }
    updateData.conditions = JSON.stringify(b.conditions);
  }

  if (Array.isArray(b.actions)) {
    const actErr = validateActions(b.actions);
    if (actErr) {
      return NextResponse.json({ error: actErr }, { status: 400, headers: rl.headers });
    }
    updateData.actions = JSON.stringify(b.actions);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400, headers: rl.headers });
  }

  const updated = await prisma.policy.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      dryRun: true,
      priority: true,
      conditions: true,
      actions: true,
      cooldownMinutes: true,
      lastTriggeredAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...updated,
    conditions: safeParseJSON(updated.conditions, []),
    actions: safeParseJSON(updated.actions, []),
  }, { headers: rl.headers });
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const auth = await resolveAuth(request);
  const rl = withRateLimit(request, rateLimitForRole(auth?.role ?? "anonymous"));
  if ("response" in rl) return rl.response;

  const writeError = requireRole(auth, "editor", rl.headers);
  if (writeError) return writeError;

  const { id } = await ctx.params;

  const existing = await prisma.policy.findFirst({
    where: { id, workspaceId: auth!.workspace.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  await prisma.policy.delete({ where: { id } });

  return new NextResponse(null, { status: 204, headers: rl.headers });
}
