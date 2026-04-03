import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse, serializeBigInt } from "@/lib/api-helpers";

interface StatsRow {
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  bondedRatio: number | null;
  blockHeight: bigint;
  avgBlockTime: number | null;
  inflation: number | null;
  totalSupply: string | null;
  bondedTokens: string | null;
  notBondedTokens: string | null;
  stakingAPR: number | null;
  nakamotoCoefficient: number | null;
  networkHealthScore: number | null;
  timestamp: Date;
}

function formatStats(s: StatsRow) {
  return {
    totalValidators: s.totalValidators,
    activeValidators: s.activeValidators,
    totalStaked: s.totalStaked,
    bondedRatio: s.bondedRatio,
    blockHeight: s.blockHeight.toString(),
    avgBlockTime: s.avgBlockTime,
    inflation: s.inflation,
    totalSupply: s.totalSupply,
    bondedTokens: s.bondedTokens,
    notBondedTokens: s.notBondedTokens,
    stakingAPR: s.stakingAPR,
    nakamotoCoefficient: s.nakamotoCoefficient,
    networkHealthScore: s.networkHealthScore,
    timestamp: s.timestamp.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const current = await prisma.networkStats.findFirst({
    orderBy: { timestamp: "desc" },
  });

  // Daily aggregate: one record per day (last entry of each day) for 90 days
  // Uses Prisma raw query to GROUP BY date and pick max timestamp per day
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const dailyHistory: StatsRow[] = await prisma.$queryRaw`
    SELECT DISTINCT ON (DATE("timestamp"))
      "totalValidators", "activeValidators", "totalStaked",
      "bondedRatio", "blockHeight", "avgBlockTime",
      "inflation", "totalSupply", "bondedTokens", "notBondedTokens",
      "stakingAPR", "nakamotoCoefficient", "networkHealthScore",
      "timestamp"
    FROM "NetworkStats"
    WHERE "timestamp" >= ${ninetyDaysAgo}
    ORDER BY DATE("timestamp") ASC, "timestamp" DESC
  `;

  return jsonResponse(
    serializeBigInt({
      current: current ? formatStats(current) : null,
      history: dailyHistory.map(formatStats),
    }),
    rl.headers,
  );
}
