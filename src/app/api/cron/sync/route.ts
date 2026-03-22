import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { syncGovernance, syncDelegations } from "@/lib/indexer";
import { runStep, type StepError } from "@/lib/cron-helpers";

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const errors: StepError[] = [];
  const LOG = "Cron Sync";

  const [governanceResults, delegationResults] = await Promise.all([
    runStep("syncGovernance", syncGovernance, errors, LOG),
    runStep("syncDelegations", syncDelegations, errors, LOG),
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
