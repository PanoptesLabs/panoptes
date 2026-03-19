import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { resolveAuth, requireRole } from "@/lib/auth";
import { POLICY_DEFAULTS } from "@/lib/constants";
import { validatePolicyCreate, safeParseJSON } from "@/lib/policy-validation";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await resolveAuth(request);
  const error = requireRole(auth, "anonymous", rl.headers);
  if (error) return error;

  const policies = await prisma.policy.findMany({
    where: { workspaceId: auth!.workspace.id },
    orderBy: { priority: "asc" },
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

  const parsed = policies.map((p) => ({
    ...p,
    conditions: safeParseJSON(p.conditions, []),
    actions: safeParseJSON(p.actions, []),
  }));

  return NextResponse.json({ policies: parsed }, { headers: rl.headers });
}

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await resolveAuth(request);
  const writeError = requireRole(auth, "editor", rl.headers);
  if (writeError) return writeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: rl.headers });
  }

  const validated = validatePolicyCreate(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400, headers: rl.headers });
  }

  let policy;
  try {
    policy = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${auth!.workspace.id} FOR UPDATE`;
      const count = await tx.policy.count({ where: { workspaceId: auth!.workspace.id } });
      if (count >= POLICY_DEFAULTS.MAX_PER_WORKSPACE) {
        throw new Error("LIMIT_REACHED");
      }
      return tx.policy.create({
        data: {
          workspaceId: auth!.workspace.id,
          name: validated.name,
          description: validated.description,
          conditions: JSON.stringify(validated.conditions),
          actions: JSON.stringify(validated.actions),
          dryRun: validated.dryRun ?? true,
          priority: validated.priority ?? 100,
          cooldownMinutes: validated.cooldownMinutes ?? 15,
        },
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
    });
  } catch (e) {
    if (e instanceof Error && e.message === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: `Policy limit reached (max ${POLICY_DEFAULTS.MAX_PER_WORKSPACE})` },
        { status: 409, headers: rl.headers },
      );
    }
    throw e;
  }

  return NextResponse.json(
    {
      ...policy,
      conditions: safeParseJSON(policy.conditions, []),
      actions: safeParseJSON(policy.actions, []),
    },
    { status: 201, headers: rl.headers },
  );
}
