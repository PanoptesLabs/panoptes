import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseDateParam, parseStringParam } from "@/lib/validation";
import { API_DEFAULTS } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - API_DEFAULTS.DEFAULT_DAYS);
  const from = parseDateParam(searchParams.get("from")) ?? defaultFrom;
  const to = parseDateParam(searchParams.get("to")) ?? new Date();
  const limit = parseIntParam(
    searchParams.get("limit"),
    API_DEFAULTS.SNAPSHOTS_LIMIT,
    1,
    API_DEFAULTS.SNAPSHOTS_MAX,
  );
  const interval =
    parseStringParam(searchParams.get("interval"), [
      "raw",
      "hourly",
      "daily",
    ]) ?? "raw";

  const validator = await prisma.validator.findUnique({ where: { id } });

  if (!validator) {
    return jsonResponse({ error: "Validator not found" }, rl.headers, 404, {
      cache: false,
    });
  }

  // Parallel queries for enrichment
  const [rankResult, delegationSnapshot, govVotes, totalProposals] = await Promise.all([
    // Rank by tokens among bonded validators
    prisma.$queryRaw<Array<{ rank: bigint }>>`
      SELECT COUNT(*) + 1 AS rank FROM "Validator"
      WHERE status = 'BOND_STATUS_BONDED'
        AND CAST(tokens AS NUMERIC) > CAST(${validator.tokens} AS NUMERIC)
    `,
    // Latest delegation snapshot
    prisma.delegationSnapshot.findFirst({
      where: { validatorId: id },
      orderBy: { timestamp: "desc" },
      select: { totalDelegators: true },
    }),
    // Governance participation: votes by this validator
    prisma.governanceVote.count({
      where: { voter: id },
    }),
    // Total proposals for participation rate
    prisma.governanceProposal.count(),
  ]);

  const rank = rankResult[0]?.rank !== undefined ? Number(rankResult[0].rank) : null;
  const delegatorCount = delegationSnapshot?.totalDelegators ?? null;
  const governanceRate = totalProposals > 0 ? govVotes / totalProposals : null;

  let snapshots;
  let snapshotCount: number;

  if (interval === "raw") {
    [snapshots, snapshotCount] = await Promise.all([
      prisma.validatorSnapshot.findMany({
        where: {
          validatorId: id,
          timestamp: { gte: from, lte: to },
        },
        orderBy: { timestamp: "desc" },
        take: limit,
      }),
      prisma.validatorSnapshot.count({
        where: {
          validatorId: id,
          timestamp: { gte: from, lte: to },
        },
      }),
    ]);
  } else {
    type SnapshotRow = {
      id: string;
      tokens: string;
      status: string;
      commission: number;
      jailed: boolean;
      votingPower: string;
      timestamp: Date;
    };

    if (interval === "hourly") {
      snapshots = await prisma.$queryRaw<SnapshotRow[]>`
        SELECT DISTINCT ON (DATE_TRUNC('hour', "timestamp"))
          "id", "tokens", "status", "commission", "jailed", "votingPower", "timestamp"
        FROM "ValidatorSnapshot"
        WHERE "validatorId" = ${id} AND "timestamp" >= ${from} AND "timestamp" <= ${to}
        ORDER BY DATE_TRUNC('hour', "timestamp") DESC, "timestamp" DESC
        LIMIT ${limit}`;
    } else {
      snapshots = await prisma.$queryRaw<SnapshotRow[]>`
        SELECT DISTINCT ON (DATE_TRUNC('day', "timestamp"))
          "id", "tokens", "status", "commission", "jailed", "votingPower", "timestamp"
        FROM "ValidatorSnapshot"
        WHERE "validatorId" = ${id} AND "timestamp" >= ${from} AND "timestamp" <= ${to}
        ORDER BY DATE_TRUNC('day', "timestamp") DESC, "timestamp" DESC
        LIMIT ${limit}`;
    }
    snapshotCount = snapshots.length;
  }

  return jsonResponse(
    {
      validator: {
        ...validator,
        lastJailedAt: validator.lastJailedAt?.toISOString() ?? null,
        firstSeen: validator.firstSeen.toISOString(),
        lastUpdated: validator.lastUpdated.toISOString(),
        rank,
        delegatorCount,
        governanceRate,
      },
      snapshots: snapshots.map((s) => ({
        id: s.id,
        tokens: s.tokens,
        status: s.status,
        commission: s.commission,
        jailed: s.jailed,
        votingPower: s.votingPower,
        timestamp:
          s.timestamp instanceof Date
            ? s.timestamp.toISOString()
            : s.timestamp,
      })),
      snapshotCount,
      interval,
      period: { from: from.toISOString(), to: to.toISOString() },
    },
    rl.headers,
  );
}
