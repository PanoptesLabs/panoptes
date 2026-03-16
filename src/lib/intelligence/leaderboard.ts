import { prisma } from "@/lib/db";

export type LeaderboardCategory =
  | "overall"
  | "uptime"
  | "commission"
  | "governance"
  | "rising"
  | "stake_magnet";

export const VALID_CATEGORIES: LeaderboardCategory[] = [
  "overall",
  "uptime",
  "commission",
  "governance",
  "rising",
  "stake_magnet",
];

export interface LeaderboardEntry {
  rank: number;
  validatorId: string;
  moniker: string;
  value: number;
  score: number;
}

export interface CompareResult {
  validatorId: string;
  moniker: string;
  metrics: {
    uptime: number;
    commission: number;
    governance: number;
    stakeStability: number;
    score: number;
  };
}

export interface TrendPoint {
  timestamp: string;
  score: number;
}

async function getValidatorsWithLatestScores() {
  const validators = await prisma.validator.findMany({
    include: {
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });
  return validators;
}

export async function getLeaderboard(
  category: LeaderboardCategory,
  limit: number,
): Promise<LeaderboardEntry[]> {
  if (category === "rising") {
    return getRisingLeaderboard(limit);
  }

  if (category === "stake_magnet") {
    return getStakeMagnetLeaderboard(limit);
  }

  const validators = await getValidatorsWithLatestScores();

  const scored = validators
    .filter((v) => v.scores.length > 0)
    .map((v) => {
      const s = v.scores[0];
      let value: number;

      switch (category) {
        case "overall":
          value = s.score;
          break;
        case "uptime":
          value = 1 - s.missedBlockRate;
          break;
        case "commission":
          value = v.commission;
          break;
        case "governance":
          value = s.governanceScore;
          break;
        default:
          value = s.score;
      }

      return {
        validatorId: v.id,
        moniker: v.moniker,
        value,
        score: s.score,
      };
    });

  // Sort: commission ASC (lower is better), everything else DESC
  if (category === "commission") {
    scored.sort((a, b) => a.value - b.value);
  } else {
    scored.sort((a, b) => b.value - a.value);
  }

  return scored.slice(0, limit).map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));
}

async function getRisingLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const validators = await prisma.validator.findMany({
    include: {
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const withScores = validators.filter((v) => v.scores.length > 0);
  const validatorIds = withScores.map((v) => v.id);

  // Bulk query: get oldest score per validator from 24h+ ago
  const allOldScores = await prisma.validatorScore.findMany({
    where: {
      validatorId: { in: validatorIds },
      timestamp: { lte: twentyFourHoursAgo },
    },
    orderBy: { timestamp: "desc" },
    distinct: ["validatorId"],
    select: { validatorId: true, score: true },
  });

  const oldScoreMap = new Map(allOldScores.map((s) => [s.validatorId, s.score]));

  const entries = withScores.map((v) => {
    const latestScore = v.scores[0];
    const oldScore = oldScoreMap.get(v.id);
    const delta = oldScore !== undefined ? latestScore.score - oldScore : 0;

    return {
      validatorId: v.id,
      moniker: v.moniker,
      value: delta,
      score: latestScore.score,
    };
  });

  entries.sort((a, b) => b.value - a.value);

  return entries.slice(0, limit).map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));
}

async function getStakeMagnetLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const validators = await prisma.validator.findMany({
    include: {
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
      delegationSnapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const withSnapshots = validators.filter(
    (v) => v.delegationSnapshots.length > 0 && v.scores.length > 0,
  );
  const validatorIds = withSnapshots.map((v) => v.id);

  // Bulk query: get oldest delegation snapshot per validator from 7d+ ago
  const allOldSnapshots = await prisma.delegationSnapshot.findMany({
    where: {
      validatorId: { in: validatorIds },
      timestamp: { lte: sevenDaysAgo },
    },
    orderBy: { timestamp: "desc" },
    distinct: ["validatorId"],
    select: { validatorId: true, totalDelegators: true },
  });

  const oldSnapshotMap = new Map(
    allOldSnapshots.map((s) => [s.validatorId, s.totalDelegators]),
  );

  const entries = withSnapshots.map((v) => {
    const latestSnapshot = v.delegationSnapshots[0];
    const oldDelegators = oldSnapshotMap.get(v.id);
    const delta =
      oldDelegators !== undefined
        ? latestSnapshot.totalDelegators - oldDelegators
        : 0;

    return {
      validatorId: v.id,
      moniker: v.moniker,
      value: delta,
      score: v.scores[0].score,
    };
  });

  entries.sort((a, b) => b.value - a.value);

  return entries.slice(0, limit).map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));
}

export async function compareValidators(ids: string[]): Promise<CompareResult[]> {
  const validators = await prisma.validator.findMany({
    where: { id: { in: ids } },
    include: {
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  return validators.map((v) => {
    const s = v.scores[0];
    return {
      validatorId: v.id,
      moniker: v.moniker,
      metrics: {
        uptime: s ? 1 - s.missedBlockRate : 0,
        commission: v.commission,
        governance: s?.governanceScore ?? 0,
        stakeStability: s?.stakeStability ?? 0,
        score: s?.score ?? 0,
      },
    };
  });
}

export async function getScoreTrend(
  validatorId: string,
  period: string,
): Promise<TrendPoint[]> {
  const periodMs: Record<string, number> = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  const ms = periodMs[period] ?? periodMs["30d"];
  const since = new Date(Date.now() - ms);

  const scores = await prisma.validatorScore.findMany({
    where: {
      validatorId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      score: true,
    },
  });

  return scores.map((s) => ({
    timestamp: s.timestamp.toISOString(),
    score: s.score,
  }));
}
