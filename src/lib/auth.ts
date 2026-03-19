import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AUTH_DEFAULTS, ROLE_HIERARCHY, ROLES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { hashToken, extractBearerToken } from "@/lib/workspace-auth";

export interface AuthContext {
  user: { id: string; address: string } | null;
  workspace: { id: string; name: string; slug: string };
  role: Role;
}

/**
 * Unified auth resolver. Tries (in order):
 * 1. Authorization: Bearer ws_... → workspace admin token → role "admin"
 * 2. Cookie `panoptes_session` → session lookup → user + WorkspaceMember role
 * 3. No credentials → public workspace lookup → role "anonymous"
 */
export async function resolveAuth(request: NextRequest): Promise<AuthContext | null> {
  // 1. Bearer workspace token auth (explicit API access — always takes priority)
  const bearerToken = extractBearerToken(request);
  if (bearerToken?.startsWith("ws_")) {
    const tokenHash = hashToken(bearerToken);
    const workspace = await prisma.workspace.findFirst({
      where: { adminTokenHash: tokenHash, isActive: true },
      select: { id: true, name: true, slug: true },
    });

    if (workspace) {
      return {
        user: null,
        workspace,
        role: ROLES.ADMIN,
      };
    }
  }

  // 2. Cookie session auth
  const sessionToken = request.cookies.get(AUTH_DEFAULTS.COOKIE_NAME)?.value;
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    const session = await prisma.userSession.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
        nonce: null, // only verified sessions (nonce cleared after verify)
      },
      include: {
        user: {
          include: {
            members: {
              include: { workspace: { select: { id: true, name: true, slug: true } } },
            },
          },
        },
      },
    });

    if (session) {
      // Find the public workspace membership
      const publicMember = session.user.members.find(
        (m: { workspace: { slug: string } }) => m.workspace.slug === AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG,
      );

      if (publicMember) {
        return {
          user: { id: session.user.id, address: session.user.address },
          workspace: publicMember.workspace,
          role: publicMember.role as Role,
        };
      }

      // User exists but no membership in public workspace — treat as viewer
      const publicWorkspace = await prisma.workspace.findFirst({
        where: { slug: AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG, isActive: true },
        select: { id: true, name: true, slug: true },
      });

      if (publicWorkspace) {
        return {
          user: { id: session.user.id, address: session.user.address },
          workspace: publicWorkspace,
          role: ROLES.VIEWER,
        };
      }
    }
  }

  // 3. Anonymous — use public workspace
  const publicWorkspace = await prisma.workspace.findFirst({
    where: { slug: AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG, isActive: true },
    select: { id: true, name: true, slug: true },
  });

  if (!publicWorkspace) return null;

  return {
    user: null,
    workspace: publicWorkspace,
    role: ROLES.ANONYMOUS,
  };
}

/**
 * Check if the given role meets the minimum required role.
 */
export function hasRole(currentRole: string, minRole: string): boolean {
  const current = ROLE_HIERARCHY[currentRole] ?? 0;
  const required = ROLE_HIERARCHY[minRole] ?? Infinity;
  return current >= required;
}

/**
 * Require a minimum role. Returns 401 if no auth, 403 if insufficient.
 */
export function requireRole(
  auth: AuthContext | null,
  minRole: Role,
  headers?: Record<string, string>,
): NextResponse | null {
  if (!auth) {
    return NextResponse.json(
      { error: "Service unavailable — no public workspace configured" },
      { status: 503, headers: headers ?? {} },
    );
  }

  if (!hasRole(auth.role, minRole)) {
    if (auth.role === ROLES.ANONYMOUS) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: headers ?? {} },
      );
    }
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403, headers: headers ?? {} },
    );
  }

  return null; // OK
}

/**
 * Redact sensitive fields based on role.
 * Anonymous/viewer: webhook URLs masked, API key prefixes hidden.
 * Member+: full data.
 */
export function redactForRole<T extends Record<string, unknown>>(
  data: T,
  role: Role,
  redactions: { field: keyof T; minRole: Role; mask?: string }[],
): T {
  const result = { ...data };
  for (const { field, minRole, mask } of redactions) {
    if (!hasRole(role, minRole) && field in result) {
      (result as Record<string, unknown>)[field as string] = mask ?? "***";
    }
  }
  return result;
}

/**
 * Return per-minute rate limit based on role.
 * Anonymous: 30, authenticated: 120.
 */
export function rateLimitForRole(role: Role): number {
  return role === "anonymous" ? 30 : 120;
}
