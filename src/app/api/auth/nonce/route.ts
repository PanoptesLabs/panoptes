import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { AUTH_DEFAULTS } from "@/lib/constants";

function isValidBech32Address(address: string): boolean {
  return /^rai1[a-z0-9]{38,}$/.test(address);
}

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request, 10);
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

  const { address } = body as { address?: string };
  if (!address || !isValidBech32Address(address)) {
    return NextResponse.json(
      { error: "Invalid address — must be a valid rai1... bech32 address" },
      { status: 400, headers: rl.headers },
    );
  }

  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + AUTH_DEFAULTS.NONCE_EXPIRY_MINUTES * 60 * 1000,
  );

  // Upsert user
  const user = await prisma.user.upsert({
    where: { address },
    update: {},
    create: { address },
  });

  // Create session with nonce (unverified — nonce present means pending)
  const tokenRaw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(tokenRaw).digest("hex");

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token: tokenHash,
      nonce,
      expiresAt,
    },
  });

  return NextResponse.json(
    { nonce, sessionId: tokenRaw },
    { status: 200, headers: rl.headers },
  );
}
