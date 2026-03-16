import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateApiKeyCreate } from "@/lib/api-key-validation";
import { generateApiKey, hashApiKey, getKeyPrefix } from "@/lib/api-key";
import { API_KEY_DEFAULTS, API_KEY_TIERS, type ApiKeyTier } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request, rl.headers);
  if (auth.error) return auth.error;

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: auth.workspace.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      tier: true,
      isActive: true,
      rateLimit: true,
      dailyQuota: true,
      monthlyQuota: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys }, { headers: rl.headers });
}

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request, rl.headers);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const validated = validateApiKeyCreate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);
  const tierConfig = API_KEY_TIERS[validated.tier as ApiKeyTier];

  const apiKey = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${auth.workspace.id} FOR UPDATE`;
    const count = await tx.apiKey.count({
      where: { workspaceId: auth.workspace.id },
    });
    if (count >= API_KEY_DEFAULTS.MAX_PER_WORKSPACE) {
      return null;
    }
    return tx.apiKey.create({
      data: {
        workspaceId: auth.workspace.id,
        name: validated.name,
        keyHash,
        keyPrefix,
        tier: validated.tier,
        rateLimit: tierConfig.rateLimit,
        dailyQuota: tierConfig.dailyQuota,
        monthlyQuota: tierConfig.monthlyQuota,
        expiresAt: validated.expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        tier: true,
        isActive: true,
        rateLimit: true,
        dailyQuota: true,
        monthlyQuota: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: `API key limit reached (max ${API_KEY_DEFAULTS.MAX_PER_WORKSPACE})` },
      { status: 409, headers: rl.headers },
    );
  }

  return NextResponse.json(
    { ...apiKey, key: rawKey },
    { status: 201, headers: rl.headers },
  );
}
