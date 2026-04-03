import { prisma } from "@/lib/db";
import { IndexerError } from "@/lib/errors";
import { REPUBLIC_CHAIN, VALIDATOR_DEFAULTS } from "@/lib/constants";
import { fetchPaginated } from "./paginate";
import { sha256 } from "@cosmjs/crypto";
import { fromBase64, toBech32 } from "@cosmjs/encoding";
import { logger } from "@/lib/logger";

interface SyncOptions {
  forceDailySnapshot?: boolean;
}

interface SyncResult {
  synced: number;
  snapshotsCreated: number;
  newValidators: number;
  signingInfosSynced: number;
  duration: number;
}

interface ChainValidator {
  operator_address: string;
  description?: { moniker?: string };
  status: string;
  tokens: string;
  commission?: { commission_rates?: { rate?: string } };
  jailed?: boolean;
  consensus_pubkey?: { key?: string };
}

interface SigningInfo {
  address: string;
  missed_blocks_counter: string;
}

const BATCH_SIZE = 25;
const TX_TIMEOUT_MS = 15_000;
const SIGNING_INFO_TIMEOUT_MS = 10_000;
const CONSENSUS_ADDRESS_PREFIX = "raivalcons";

function deriveConsensusAddress(pubkeyBase64: string): string {
  const pubkeyBytes = fromBase64(pubkeyBase64);
  const hash = sha256(pubkeyBytes);
  const addr = hash.slice(0, 20);
  return toBech32(CONSENSUS_ADDRESS_PREFIX, addr);
}

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

async function fetchSigningInfos(): Promise<SigningInfo[]> {
  return fetchPaginated<SigningInfo>(
    (nextKey) => {
      const base = `${REPUBLIC_CHAIN.restUrl}/cosmos/slashing/v1beta1/signing_infos?pagination.limit=200`;
      return nextKey ? `${base}&pagination.key=${encodeURIComponent(nextKey)}` : base;
    },
    (data) => ((data.info as SigningInfo[]) ?? []),
    { timeoutMs: SIGNING_INFO_TIMEOUT_MS, label: "signing-infos" },
  );
}

async function fetchSignedBlocksWindow(): Promise<number> {
  try {
    const res = await fetch(
      `${REPUBLIC_CHAIN.restUrl}/cosmos/slashing/v1beta1/params`,
      { signal: AbortSignal.timeout(SIGNING_INFO_TIMEOUT_MS) },
    );
    if (!res.ok) return 10_000;
    const data = (await res.json()) as { params?: { signed_blocks_window?: string } };
    return parseInt(data.params?.signed_blocks_window ?? "10000", 10) || 10_000;
  } catch {
    return 10_000;
  }
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
      consensusPubkey: v.consensus_pubkey?.key ?? null,
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

          // Derive consensus address from pubkey
          let consensusAddress = prev?.consensusAddress ?? null;
          if (val.consensusPubkey && !consensusAddress) {
            try {
              consensusAddress = deriveConsensusAddress(val.consensusPubkey);
            } catch {
              // skip if derivation fails
            }
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
              consensusPubkey: val.consensusPubkey,
              consensusAddress,
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
              consensusPubkey: val.consensusPubkey,
              consensusAddress,
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

    // Sync signing infos → missedBlocks + uptime
    let signingInfosSynced = 0;
    try {
      const [signingInfos, window] = await Promise.all([
        fetchSigningInfos(),
        fetchSignedBlocksWindow(),
      ]);

      // Build consensus address → signing info map
      const signingMap = new Map(signingInfos.map((si) => [si.address, si]));

      // Get all validators with consensus addresses
      const validatorsWithConsensus = await prisma.validator.findMany({
        where: { consensusAddress: { not: null } },
        select: { id: true, consensusAddress: true },
      });

      for (let i = 0; i < validatorsWithConsensus.length; i += BATCH_SIZE) {
        const batch = validatorsWithConsensus.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(async (tx) => {
          for (const v of batch) {
            const info = signingMap.get(v.consensusAddress!);
            if (!info) continue;

            const missedBlocks = parseInt(info.missed_blocks_counter, 10) || 0;
            const uptime = Math.max(0, Math.min(1, (window - missedBlocks) / window));

            await tx.validator.update({
              where: { id: v.id },
              data: { missedBlocks, uptime },
            });
            signingInfosSynced++;
          }
        }, { timeout: TX_TIMEOUT_MS });
      }
    } catch (err) {
      logger.warn("validators", `Signing info sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      synced: validators.length,
      snapshotsCreated,
      newValidators,
      signingInfosSynced,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to sync validators: ${error instanceof Error ? error.message : String(error)}`,
      "validators",
    );
  }
}
