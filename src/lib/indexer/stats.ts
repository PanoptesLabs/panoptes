import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";
import { IndexerError } from "@/lib/errors";
import { publishEvent } from "@/lib/events/publish";
import { CHANNELS } from "@/lib/events/event-types";
import { REPUBLIC_CHAIN } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { computeNetworkHealthScore } from "@/lib/intelligence/scoring";

type BlockHeightSource = "rpc" | "rest" | "cache";

const REST_TIMEOUT_MS = 5_000;

async function fetchBlockHeight(): Promise<{ blockHeight: bigint; source: BlockHeightSource }> {
  // 1) RPC — primary source
  try {
    const client = getRepublicClient();
    const status = await client.getStatus();
    const height = BigInt(status.syncInfo?.latestBlockHeight ?? "0");
    if (height > 0n) return { blockHeight: height, source: "rpc" };
  } catch {
    logger.warn("aggregateStats", "RPC unreachable, trying REST fallback");
  }

  // 2) REST — secondary source
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
    const res = await fetch(
      `${REPUBLIC_CHAIN.restUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const height = BigInt(data?.block?.header?.height ?? "0");
      if (height > 0n) return { blockHeight: height, source: "rest" };
    }
  } catch {
    logger.warn("aggregateStats", "REST unreachable, using cached blockHeight");
  }

  // 3) DB cache — last known value
  const last = await prisma.networkStats.findFirst({
    orderBy: { timestamp: "desc" },
    select: { blockHeight: true },
  });
  if (last) return { blockHeight: last.blockHeight, source: "cache" };

  return { blockHeight: 0n, source: "cache" };
}

async function fetchJsonSafe<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${REPUBLIC_CHAIN.restUrl}${path}`, {
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ChainPool { pool?: { bonded_tokens?: string; not_bonded_tokens?: string } }
interface ChainInflation { inflation?: string }
interface ChainSupply { supply?: Array<{ denom: string; amount: string }> }

function computeNakamotoCoefficient(validators: Array<{ tokens: string; status: string }>): number {
  const bonded = validators
    .filter((v) => v.status === "BOND_STATUS_BONDED")
    .map((v) => BigInt(v.tokens))
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  if (bonded.length === 0) return 0;

  const totalPower = bonded.reduce((sum, t) => sum + t, 0n);
  const threshold = (totalPower * 100n) / 300n; // 33.3%

  let cumulative = 0n;
  for (let i = 0; i < bonded.length; i++) {
    cumulative += bonded[i];
    if (cumulative >= threshold) return i + 1;
  }
  return bonded.length;
}

export async function aggregateStats(): Promise<{
  blockHeight: string;
  blockHeightSource: BlockHeightSource;
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  duration: number;
}> {
  const start = Date.now();

  try {
    const { blockHeight, source } = await fetchBlockHeight();

    const [totalValidators, activeValidators] = await Promise.all([
      prisma.validator.count(),
      prisma.validator.count({
        where: { status: "BOND_STATUS_BONDED" },
      }),
    ]);

    // Sum tokens for bonded ratio — use TEXT to avoid bigint overflow
    const tokenSum: Array<{ total: string }> = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
      FROM "Validator"
      WHERE status = 'BOND_STATUS_BONDED'
    `;
    const totalStaked = tokenSum[0]?.total ?? "0";

    // Bonded ratio: bonded tokens / all tokens
    const allTokenSum: Array<{ total: string }> = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
      FROM "Validator"
    `;
    const bondedStaked = BigInt(totalStaked);
    const allTokens = BigInt(allTokenSum[0]?.total ?? "0");
    const bondedRatio =
      allTokens > 0n
        ? Number((bondedStaked * 10000n) / allTokens) / 10000
        : null;

    // Avg block time from last 2 stats — skip when using cached height (stale value)
    let avgBlockTime: number | null = null;
    if (source !== "cache") {
      const lastTwo = await prisma.networkStats.findMany({
        orderBy: { timestamp: "desc" },
        take: 2,
        select: { blockHeight: true, timestamp: true },
      });
      if (lastTwo.length === 2) {
        const heightDiff = Number(blockHeight - lastTwo[1].blockHeight);
        const timeDiffMs =
          lastTwo[0].timestamp.getTime() - lastTwo[1].timestamp.getTime();
        if (heightDiff > 0 && timeDiffMs > 0) {
          avgBlockTime = timeDiffMs / 1000 / heightDiff;
        }
      }
    }

    // Fetch chain economics data
    const [poolData, inflationData, supplyData] = await Promise.all([
      fetchJsonSafe<ChainPool>("/cosmos/staking/v1beta1/pool"),
      fetchJsonSafe<ChainInflation>("/cosmos/mint/v1beta1/inflation"),
      fetchJsonSafe<ChainSupply>("/cosmos/bank/v1beta1/supply"),
    ]);

    const bondedTokens = poolData?.pool?.bonded_tokens ?? null;
    const notBondedTokens = poolData?.pool?.not_bonded_tokens ?? null;
    const inflation = inflationData?.inflation ? parseFloat(inflationData.inflation) : null;
    const totalSupplyEntry = supplyData?.supply?.find((s) => s.denom === "arai") ?? supplyData?.supply?.[0];
    const totalSupply = totalSupplyEntry?.amount ?? null;

    // Staking APR = inflation * totalSupply / bondedTokens
    let stakingAPR: number | null = null;
    if (inflation !== null && totalSupply && bondedTokens) {
      const totalSupplyNum = parseFloat(totalSupply);
      const bondedNum = parseFloat(bondedTokens);
      if (bondedNum > 0) {
        stakingAPR = (inflation * totalSupplyNum) / bondedNum;
      }
    }

    // Nakamoto coefficient
    const allValidators = await prisma.validator.findMany({
      select: { tokens: true, status: true },
    });
    const nakamotoCoefficient = computeNakamotoCoefficient(allValidators);

    // Network health score — pass fresh values from this run
    let networkHealthScore: number | null = null;
    try {
      networkHealthScore = await computeNetworkHealthScore({
        bondedRatio,
        avgBlockTime,
        nakamotoCoefficient,
      });
    } catch {
      // Non-fatal: scoring may fail if data is sparse
    }

    await prisma.networkStats.create({
      data: {
        totalValidators,
        activeValidators,
        totalStaked,
        bondedRatio,
        blockHeight,
        avgBlockTime,
        inflation,
        totalSupply,
        bondedTokens,
        notBondedTokens,
        stakingAPR,
        nakamotoCoefficient,
        networkHealthScore,
      },
    });

    await publishEvent({
      channel: CHANNELS.NETWORK,
      type: "stats.updated",
      payload: {
        blockHeight: blockHeight.toString(),
        totalValidators,
        activeValidators,
        totalStaked,
        bondedRatio,
        avgBlockTime,
      },
    });

    return {
      blockHeight: blockHeight.toString(),
      blockHeightSource: source,
      totalValidators,
      activeValidators,
      totalStaked,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to aggregate stats: ${error instanceof Error ? error.message : String(error)}`,
      "stats",
    );
  }
}
