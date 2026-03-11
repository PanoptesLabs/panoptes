/* eslint-disable no-console */
import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashToken } from "../src/lib/workspace-auth.js";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const KNOWN_ENDPOINTS = [
  {
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://rest.republicai.io",
    type: "rest",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://evm-rpc.republicai.io",
    type: "evm-rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("[seed] Seeding endpoints...");

  for (const ep of KNOWN_ENDPOINTS) {
    await prisma.endpoint.upsert({
      where: { url: ep.url },
      create: ep,
      update: {
        type: ep.type,
        provider: ep.provider,
        isOfficial: ep.isOfficial,
      },
    });
    console.log(`  + ${ep.url} (${ep.type})`);
  }

  // Seed default workspace
  const adminToken = process.env.PANOPTES_ADMIN_TOKEN;
  if (adminToken) {
    const tokenHash = hashToken(adminToken);
    await prisma.workspace.upsert({
      where: { slug: "default" },
      create: {
        name: "Default Workspace",
        slug: "default",
        adminTokenHash: tokenHash,
      },
      update: {
        adminTokenHash: tokenHash,
      },
    });
    console.log("  + Default workspace (slug: default)");
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PANOPTES_ADMIN_TOKEN is required in production. Generate with: openssl rand -hex 32",
    );
  } else {
    console.warn(
      "  ⚠ PANOPTES_ADMIN_TOKEN not set, skipping workspace seed (non-production)",
    );
  }

  console.log("[seed] Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[seed] Error:", e);
  process.exit(1);
});
