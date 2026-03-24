/* eslint-disable no-console */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AUTH_DEFAULTS } from "../src/lib/constants.js";

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

  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
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

  // Seed default workspace (token-free — auth is via wallet session)
  await prisma.workspace.upsert({
    where: { slug: AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG },
    create: {
      name: "Republic Community",
      slug: AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG,
    },
    update: {},
  });
  console.log(`  + Default workspace (slug: ${AUTH_DEFAULTS.PUBLIC_WORKSPACE_SLUG})`);

  console.log("[seed] Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[seed] Error:", e);
  process.exit(1);
});
