import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { AUTH_DEFAULTS, ROLES } from "@/lib/constants";
import { verifySignatureWithDiag } from "@/lib/signature";
import { logger } from "@/lib/logger";
import { isAdminAddress } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request, 5);
  if ("response" in rl) return rl.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const { address, pubKey, signature, sessionId } = body as {
    address?: string;
    pubKey?: string;
    signature?: string;
    sessionId?: string;
  };

  if (!address || !pubKey || !signature || !sessionId) {
    return NextResponse.json(
      { error: "Missing required fields: address, pubKey, signature, sessionId" },
      { status: 400, headers: rl.headers },
    );
  }

  // Find pending session by sessionId hash
  const sessionHash = createHash("sha256").update(sessionId).digest("hex");
  const session = await prisma.userSession.findFirst({
    where: {
      token: sessionHash,
      nonce: { not: null },
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session || !session.nonce) {
    return NextResponse.json(
      { error: "Invalid or expired nonce" },
      { status: 401, headers: rl.headers },
    );
  }

  if (session.user.address !== address) {
    return NextResponse.json(
      { error: "Address mismatch" },
      { status: 401, headers: rl.headers },
    );
  }

  // Verify signature (EIP-191 for Ethermint, ADR-036 fallback)
  const result = await verifySignatureWithDiag(
    address,
    session.nonce,
    pubKey,
    signature,
  );

  if (!result.valid) {
    logger.error("auth/verify", "Signature verification failed");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401, headers: rl.headers },
    );
  }

  // Signature valid — create verified session
  const newTokenRaw = randomBytes(32).toString("hex");
  const newTokenHash = createHash("sha256").update(newTokenRaw).digest("hex");
  const expiresAt = new Date(
    Date.now() + AUTH_DEFAULTS.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  // Delete old pending session, create new verified one
  await prisma.$transaction([
    prisma.userSession.delete({ where: { id: session.id } }),
    prisma.userSession.create({
      data: {
        userId: session.userId,
        token: newTokenHash,
        nonce: null,
        expiresAt,
      },
    }),
  ]);

  // Ensure user is a member of the public workspace
  const publicWorkspace = await prisma.workspace.findFirst({
    where: { slug: AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG, isActive: true },
  });

  // Check if address is an admin (cached)
  const isAdmin = isAdminAddress(address);

  let role = ROLES.VIEWER;
  if (publicWorkspace) {
    const member = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: publicWorkspace.id,
          userId: session.userId,
        },
      },
      update: isAdmin ? { role: ROLES.ADMIN } : {},
      create: {
        workspaceId: publicWorkspace.id,
        userId: session.userId,
        role: isAdmin ? ROLES.ADMIN : ROLES.VIEWER,
      },
    });
    role = member.role as typeof role;
  }

  const response = NextResponse.json(
    {
      user: { id: session.userId, address },
      role,
    },
    { status: 200, headers: rl.headers },
  );

  response.cookies.set(AUTH_DEFAULTS.COOKIE_NAME, newTokenRaw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: AUTH_DEFAULTS.SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
