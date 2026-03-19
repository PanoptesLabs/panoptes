import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { AUTH_DEFAULTS } from "@/lib/constants";
import { hashToken } from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const sessionToken = request.cookies.get(AUTH_DEFAULTS.COOKIE_NAME)?.value;
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    await prisma.userSession.deleteMany({
      where: { token: tokenHash },
    });
  }

  const response = NextResponse.json(
    { success: true },
    { status: 200, headers: rl.headers },
  );

  response.cookies.set(AUTH_DEFAULTS.COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
