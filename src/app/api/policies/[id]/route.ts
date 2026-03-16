import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { POLICY_DEFAULTS, POLICY_OPERATORS, POLICY_ACTION_TYPES } from "@/lib/constants";
import { ALLOWED_FIELDS } from "@/lib/intelligence/policy-conditions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  const policy = await prisma.policy.findFirst({
    where: { id, workspaceId: auth.workspace.id },
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
    conditions: JSON.parse(policy.conditions),
    actions: JSON.parse(policy.actions),
    executions: policy.executions.map((e) => ({
      ...e,
      conditionsMet: JSON.parse(e.conditionsMet),
      actionsTaken: JSON.parse(e.actionsTaken),
      actionsResults: JSON.parse(e.actionsResults),
    })),
  }, { headers: rl.headers });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  const existing = await prisma.policy.findFirst({
    where: { id, workspaceId: auth.workspace.id },
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
    if (b.cooldownMinutes < POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES ||
        b.cooldownMinutes > POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES) {
      return NextResponse.json(
        { error: `Cooldown must be between ${POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES} and ${POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES} minutes` },
        { status: 400, headers: rl.headers },
      );
    }
    updateData.cooldownMinutes = b.cooldownMinutes;
  }

  if (Array.isArray(b.conditions)) {
    if (b.conditions.length === 0) {
      return NextResponse.json({ error: "At least one condition is required" }, { status: 400, headers: rl.headers });
    }
    if (b.conditions.length > POLICY_DEFAULTS.MAX_CONDITIONS) {
      return NextResponse.json(
        { error: `Maximum ${POLICY_DEFAULTS.MAX_CONDITIONS} conditions allowed` },
        { status: 400, headers: rl.headers },
      );
    }
    for (const c of b.conditions) {
      if (!c || typeof c !== "object" || !c.field || !c.operator || c.value === undefined) {
        return NextResponse.json(
          { error: "Each condition must have field, operator, and value" },
          { status: 400, headers: rl.headers },
        );
      }
      if (!(POLICY_OPERATORS as readonly string[]).includes(c.operator)) {
        return NextResponse.json({ error: `Invalid operator: ${c.operator}` }, { status: 400, headers: rl.headers });
      }
      if (!ALLOWED_FIELDS.has(c.field)) {
        return NextResponse.json({ error: `Invalid condition field: ${c.field}` }, { status: 400, headers: rl.headers });
      }
    }
    updateData.conditions = JSON.stringify(b.conditions);
  }

  if (Array.isArray(b.actions)) {
    if (b.actions.length === 0) {
      return NextResponse.json({ error: "At least one action is required" }, { status: 400, headers: rl.headers });
    }
    if (b.actions.length > POLICY_DEFAULTS.MAX_ACTIONS) {
      return NextResponse.json(
        { error: `Maximum ${POLICY_DEFAULTS.MAX_ACTIONS} actions allowed` },
        { status: 400, headers: rl.headers },
      );
    }
    for (const a of b.actions) {
      if (!a || typeof a !== "object" || !(POLICY_ACTION_TYPES as readonly string[]).includes(a.type)) {
        return NextResponse.json({ error: `Invalid action type: ${a?.type}` }, { status: 400, headers: rl.headers });
      }
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
    conditions: JSON.parse(updated.conditions),
    actions: JSON.parse(updated.actions),
  }, { headers: rl.headers });
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  const existing = await prisma.policy.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  await prisma.policy.delete({ where: { id } });

  return new NextResponse(null, { status: 204, headers: rl.headers });
}
