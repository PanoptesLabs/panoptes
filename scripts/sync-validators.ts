/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "./db.js";

interface ChainValidator {
  operator_address: string;
  description?: { moniker?: string };
  status: string;
  tokens: string;
  commission?: { commission_rates?: { rate?: string } };
  jailed?: boolean;
}

interface SyncResult {
  synced: number;
  snapshotsCreated: number;
  newValidators: number;
  duration: number;
}

const BATCH_SIZE = 25;
const TX_TIMEOUT_MS = 15_000;
const VALIDATOR_FETCH_LIMIT = 200;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGES = 50;

async function fetchAllValidators(): Promise<ChainValidator[]> {
  const restUrl = process.env.REPUBLIC_REST_URL || "https://rest.republicai.io";
  const all: ChainValidator[] = [];
  let nextKey: string | null = null;
  let prevKey: string | null = null;
  let page = 0;

  do {
    if (page >= MAX_PAGES) {
      console.warn(`[sync-validators] Reached max page limit (${MAX_PAGES}), stopping pagination`);
      break;
    }

    const base = `${restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=${VALIDATOR_FETCH_LIMIT}`;
    const url = nextKey ? `${base}&pagination.key=${encodeURIComponent(nextKey)}` : base;

    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Validator fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const validators = (data.validators as ChainValidator[]) ?? [];
    all.push(...validators);

    const pagination = data.pagination as { next_key?: string } | undefined;
    nextKey = pagination?.next_key ?? null;

    // Guard against stuck cursor (same key returned twice)
    if (nextKey && nextKey === prevKey) {
      console.warn(`[sync-validators] Pagination cursor stuck at "${nextKey}", stopping`);
      break;
    }
    prevKey = nextKey;
    page++;
  } while (nextKey);

  return all;
}

async function syncValidators(
  forceDailySnapshot = false,
): Promise<SyncResult> {
  const start = Date.now();

  const chainValidators = await fetchAllValidators();
  const validators = chainValidators.map((v) => ({
    operatorAddress: v.operator_address,
    moniker: v.description?.moniker || "",
    status: v.status,
    tokens: v.tokens || "0",
    commission: v.commission?.commission_rates?.rate || "0",
    jailed: v.jailed || false,
  }));

  const existing = await prisma.validator.findMany();
  const existingMap = new Map(existing.map((v) => [v.id, v]));

  let snapshotsCreated = 0;
  let newValidators = 0;

  // Process in batches to reduce transaction overhead
  for (let i = 0; i < validators.length; i += BATCH_SIZE) {
    const batch = validators.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const val of batch) {
        const commission = parseFloat(val.commission) || 0;
        const prev = existingMap.get(val.operatorAddress);

        const hasChanged =
          !prev ||
          prev.tokens !== val.tokens ||
          prev.status !== val.status ||
          prev.commission !== commission ||
          prev.jailed !== val.jailed;

        const shouldSnapshot = hasChanged || forceDailySnapshot;

        let jailCount = prev?.jailCount ?? 0;
        let lastJailedAt = prev?.lastJailedAt ?? null;
        if (prev && !prev.jailed && val.jailed) {
          jailCount += 1;
          lastJailedAt = new Date();
        }

        if (!prev) newValidators++;

        await tx.validator.upsert({
          where: { id: val.operatorAddress },
          create: {
            id: val.operatorAddress,
            moniker: val.moniker,
            status: val.status,
            tokens: val.tokens,
            commission,
            jailed: val.jailed,
            votingPower: val.tokens,
            jailCount,
            lastJailedAt,
          },
          update: {
            moniker: val.moniker,
            status: val.status,
            tokens: val.tokens,
            commission,
            jailed: val.jailed,
            votingPower: val.tokens,
            jailCount,
            lastJailedAt,
          },
        });

        if (shouldSnapshot) {
          await tx.validatorSnapshot.create({
            data: {
              validatorId: val.operatorAddress,
              tokens: val.tokens,
              status: val.status,
              commission,
              jailed: val.jailed,
              votingPower: val.tokens,
            },
          });
          snapshotsCreated++;
        }
      }
    }, { timeout: TX_TIMEOUT_MS });
  }

  return {
    synced: validators.length,
    snapshotsCreated,
    newValidators,
    duration: Date.now() - start,
  };
}

async function main() {
  console.log("[sync-validators] Starting...");

  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  // Only trigger daily snapshot in the first 5-min window (00:00-00:04 UTC)
  const forceDailySnapshot = hour === 0 && minute < 5;

  if (forceDailySnapshot) {
    console.log("[sync-validators] Daily snapshot mode (00:00 UTC)");
  }

  try {
    const result = await syncValidators(forceDailySnapshot);
    console.log(
      `[sync-validators] Done: ${result.synced} synced, ${result.snapshotsCreated} snapshots, ${result.newValidators} new, ${result.duration}ms`,
    );
    process.exit(0);
  } catch (error) {
    console.error("[sync-validators] Failed:", error);
    process.exit(1);
  }
}

main();
