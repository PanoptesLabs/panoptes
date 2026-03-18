import { prisma } from "@/lib/db";
import { IndexerError } from "@/lib/errors";
import { REPUBLIC_CHAIN, VALIDATOR_DEFAULTS } from "@/lib/constants";
import { fetchPaginated } from "./paginate";

interface SyncOptions {
  forceDailySnapshot?: boolean;
}

interface SyncResult {
  synced: number;
  snapshotsCreated: number;
  newValidators: number;
  duration: number;
}

interface ChainValidator {
  operator_address: string;
  description?: { moniker?: string };
  status: string;
  tokens: string;
  commission?: { commission_rates?: { rate?: string } };
  jailed?: boolean;
}

const BATCH_SIZE = 25;
const TX_TIMEOUT_MS = 15_000;

function fetchAllValidators(): Promise<ChainValidator[]> {
  return fetchPaginated<ChainValidator>(
    (nextKey) => {
      const base = `${REPUBLIC_CHAIN.restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=${VALIDATOR_DEFAULTS.VALIDATOR_FETCH_LIMIT}`;
      return nextKey ? `${base}&pagination.key=${encodeURIComponent(nextKey)}` : base;
    },
    (data) => ((data.validators as ChainValidator[]) ?? []),
    { timeoutMs: VALIDATOR_DEFAULTS.FETCH_TIMEOUT_MS, label: "validators" },
  );
}

export async function syncValidators(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const start = Date.now();
  const { forceDailySnapshot = false } = options;

  try {
    const chainValidators = await fetchAllValidators();

    if (chainValidators.length === 0) {
      throw new Error(
        "Validator fetch returned 0 results — possible chain/network error",
      );
    }

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

          // Detect new jailing
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
  } catch (error) {
    throw new IndexerError(
      `Failed to sync validators: ${error instanceof Error ? error.message : String(error)}`,
      "validators",
    );
  }
}
