import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { syncGovernance, syncDelegations } from "@/lib/indexer";
import { logger } from "@/lib/logger";

type StepError = { step: string; error: string };

async function runStep<T>(name: string, fn: () => Promise<T>, errors: StepError[]): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Cron Sync: ${name}`, msg);
    errors.push({ step: name, error: msg });
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const errors: StepError[] = [];

  const [governanceResults, delegationResults] = await Promise.all([
    runStep("syncGovernance", syncGovernance, errors),
    runStep("syncDelegations", syncDelegations, errors),
  ]);

  const status = errors.length === 0 ? 200 : 207;

  return NextResponse.json({
    success: errors.length === 0,
    partial: errors.length > 0 && errors.length < 2,
    governance: {
      proposalsSynced: governanceResults?.proposalsSynced ?? 0,
      votesSynced: governanceResults?.votesSynced ?? 0,
    },
    delegations: {
      eventsSynced: delegationResults?.eventsSynced ?? 0,
      snapshotsTaken: delegationResults?.snapshotsTaken ?? 0,
    },
    errors: errors.length > 0 ? errors : undefined,
  }, { status });
}
