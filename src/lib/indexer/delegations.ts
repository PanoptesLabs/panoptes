import { prisma } from "@/lib/db";
import { REPUBLIC_CHAIN, DELEGATION_DEFAULTS } from "@/lib/constants";
import { fetchPaginated } from "./paginate";
import { logger } from "@/lib/logger";

const DELEGATION_CONCURRENCY = 20;

interface ChainDelegation {
  delegation: {
    delegator_address: string;
    validator_address: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface DelegationSyncResult {
  eventsSynced: number;
  snapshotsTaken: number;
  duration: number;
}

function fetchValidatorDelegations(validatorAddr: string): Promise<ChainDelegation[]> {
  return fetchPaginated<ChainDelegation>(
    (nextKey) => {
      const base = `${REPUBLIC_CHAIN.restUrl}/cosmos/staking/v1beta1/validators/${validatorAddr}/delegations?pagination.limit=${DELEGATION_DEFAULTS.DELEGATION_FETCH_LIMIT}`;
      return nextKey ? `${base}&pagination.key=${encodeURIComponent(nextKey)}` : base;
    },
    (data) => ((data.delegation_responses as ChainDelegation[]) ?? []),
    { timeoutMs: DELEGATION_DEFAULTS.FETCH_TIMEOUT_MS, label: "delegations" },
  );
}

async function processValidatorDelegations(val: { id: string; moniker: string }): Promise<{ events: number; snapshot: number }> {
  let events = 0;

  const delegations = await fetchValidatorDelegations(val.id);

  // Get previous snapshot for comparison
  const prevSnapshot = await prisma.delegationSnapshot.findFirst({
    where: { validatorId: val.id },
    orderBy: { timestamp: "desc" },
  });

  const prevDelegators = new Map<string, string>();
  if (prevSnapshot?.topDelegators) {
    try {
      const parsed = JSON.parse(prevSnapshot.topDelegators) as Array<{ address: string; amount: string }>;
      for (const d of parsed) {
        prevDelegators.set(d.address, d.amount);
      }
    } catch {
      // ignore parse errors
    }
  }

  // Build current state
  const currentDelegators = new Map<string, string>();
  let totalDelegated = 0n;

  for (const d of delegations) {
    const addr = d.delegation.delegator_address;
    const amount = d.balance.amount;
    currentDelegators.set(addr, amount);
    totalDelegated += BigInt(amount);
  }

  // Detect delegation events by comparing with prev snapshot (if exists)
  if (prevSnapshot) {
    const newEvents: Array<{
      type: string;
      delegator: string;
      validatorTo: string;
      amount: string;
    }> = [];

    // New delegations
    for (const [addr, amount] of currentDelegators) {
      const prevAmount = prevDelegators.get(addr);
      if (!prevAmount) {
        newEvents.push({
          type: "delegate",
          delegator: addr,
          validatorTo: val.id,
          amount,
        });
      } else if (BigInt(amount) > BigInt(prevAmount)) {
        newEvents.push({
          type: "delegate",
          delegator: addr,
          validatorTo: val.id,
          amount: (BigInt(amount) - BigInt(prevAmount)).toString(),
        });
      }
    }

    // Undelegations
    for (const [addr, amount] of prevDelegators) {
      const currentAmount = currentDelegators.get(addr);
      if (!currentAmount) {
        newEvents.push({
          type: "undelegate",
          delegator: addr,
          validatorTo: val.id,
          amount,
        });
      } else if (BigInt(currentAmount) < BigInt(amount)) {
        newEvents.push({
          type: "undelegate",
          delegator: addr,
          validatorTo: val.id,
          amount: (BigInt(amount) - BigInt(currentAmount)).toString(),
        });
      }
    }

    if (newEvents.length > 0) {
      await prisma.delegationEvent.createMany({ data: newEvents });
      events = newEvents.length;
    }
  }

  // Build top delegators
  const sorted = [...currentDelegators.entries()]
    .sort((a, b) => {
      const diff = BigInt(b[1]) - BigInt(a[1]);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    })
    .slice(0, DELEGATION_DEFAULTS.SNAPSHOT_TOP_DELEGATORS)
    .map(([address, amount]) => ({ address, amount }));

  // Calculate churn rate
  const prevTotal = prevSnapshot ? BigInt(prevSnapshot.totalDelegated) : 0n;
  const churnRate = prevTotal > 0n
    ? Math.abs(Number(((totalDelegated - prevTotal) * 10000n) / prevTotal)) / 100
    : 0;

  // Create snapshot
  await prisma.delegationSnapshot.create({
    data: {
      validatorId: val.id,
      totalDelegators: currentDelegators.size,
      totalDelegated: totalDelegated.toString(),
      topDelegators: JSON.stringify(sorted),
      churnRate,
    },
  });

  return { events, snapshot: 1 };
}

export async function syncDelegations(): Promise<DelegationSyncResult> {
  const start = Date.now();
  let eventsSynced = 0;
  let snapshotsTaken = 0;

  const validators = await prisma.validator.findMany({
    select: { id: true, moniker: true },
  });

  for (let i = 0; i < validators.length; i += DELEGATION_CONCURRENCY) {
    const batch = validators.slice(i, i + DELEGATION_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((v) => processValidatorDelegations(v)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        eventsSynced += r.value.events;
        snapshotsTaken += r.value.snapshot;
      } else {
        logger.error("[delegations] Validator sync failed", r.reason);
      }
    }
  }

  return { eventsSynced, snapshotsTaken, duration: Date.now() - start };
}
