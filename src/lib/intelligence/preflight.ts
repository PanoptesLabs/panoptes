import { prisma } from "@/lib/db";
import { PREFLIGHT } from "@/lib/constants";
import type { PreflightCheck, PreflightResponse, PreflightStatus } from "@/types";

function createCheck(
  name: string,
  status: PreflightStatus,
  message: string,
  details?: Record<string, unknown>,
): PreflightCheck {
  return details ? { name, status, message, details } : { name, status, message };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function checkEndpointHealth(): Promise<PreflightCheck> {
  try {
    const bestEndpoint = await prisma.endpointScore.findFirst({
      where: {
        endpoint: { isActive: true, type: "rpc" },
      },
      orderBy: { score: "desc" },
      include: { endpoint: true },
    });

    if (!bestEndpoint) {
      return createCheck("endpoint_health", "warn", "No scored endpoints available");
    }

    const score = bestEndpoint.score;
    let status: PreflightStatus = "pass";
    if (score < 50) status = "fail";
    else if (score < 70) status = "warn";

    return createCheck(
      "endpoint_health",
      status,
      `Best RPC endpoint score: ${Math.round(score)}/100 (${bestEndpoint.endpoint.url})`,
      { endpointUrl: bestEndpoint.endpoint.url, score },
    );
  } catch {
    return createCheck("endpoint_health", "warn", "Unable to check endpoint health");
  }
}

async function checkAccountExists(address: string, restEndpoint: { url: string } | null): Promise<PreflightCheck> {
  try {
    if (!restEndpoint) {
      return createCheck("account_exists", "warn", "No REST endpoint available to verify account");
    }

    const res = await fetch(
      `${restEndpoint.url}/cosmos/auth/v1beta1/accounts/${address}`,
      { signal: AbortSignal.timeout(PREFLIGHT.FETCH_TIMEOUT_MS) },
    );

    if (res.ok) {
      return createCheck("account_exists", "pass", `Account ${address} found on chain`);
    }

    return createCheck("account_exists", "warn", "Account not found on chain, may be new");
  } catch {
    return createCheck("account_exists", "warn", "Unable to verify account existence");
  }
}

async function checkBalance(
  address: string,
  amount: string,
  denom: string,
  restEndpoint: { url: string } | null,
): Promise<PreflightCheck> {
  try {
    if (!restEndpoint) {
      return createCheck("balance_check", "warn", "No REST endpoint available to check balance");
    }

    const res = await fetch(
      `${restEndpoint.url}/cosmos/bank/v1beta1/balances/${address}`,
      { signal: AbortSignal.timeout(PREFLIGHT.FETCH_TIMEOUT_MS) },
    );

    if (!res.ok) {
      return createCheck("balance_check", "warn", "Unable to fetch balance");
    }

    const data = await res.json();
    const balances = data.balances || [];
    const tokenBalance = balances.find(
      (b: { denom: string; amount: string }) => b.denom.toLowerCase() === denom.toLowerCase(),
    );
    const balance = BigInt(tokenBalance?.amount ?? "0");
    const required = BigInt(amount);
    const gasEstimate = BigInt(PREFLIGHT.DEFAULT_GAS_LIMIT);
    const balDetails = { balance: balance.toString(), required: amount, denom };

    if (balance >= required + gasEstimate) {
      return createCheck("balance_check", "pass", `Sufficient balance: ${balance} ${denom} (need ${required} + ~${gasEstimate} gas)`, balDetails);
    }

    if (balance >= required) {
      return createCheck("balance_check", "warn", `Balance covers amount but gas may be insufficient: ${balance} ${denom}`, balDetails);
    }

    return createCheck("balance_check", "fail", `Insufficient balance: ${balance} ${denom} (need ${required})`, balDetails);
  } catch {
    return createCheck("balance_check", "warn", "Unable to verify balance");
  }
}

function checkGasEstimation(amount: string): PreflightCheck {
  const gasEstimate = PREFLIGHT.DEFAULT_GAS_LIMIT;
  return createCheck("gas_estimation", "pass", `Estimated gas limit: ${gasEstimate}`, { gasLimit: gasEstimate, amount });
}

async function checkValidatorStatus(
  validatorAddress: string,
): Promise<PreflightCheck> {
  try {
    const validator = await prisma.validator.findUnique({
      where: { id: validatorAddress },
      include: {
        scores: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    if (!validator) {
      return createCheck("validator_status", "warn", `Validator ${validatorAddress} not found in database`);
    }

    const valDetails = { moniker: validator.moniker, status: validator.status };

    if (validator.jailed) {
      return createCheck("validator_status", "fail", `Validator ${validator.moniker} is jailed`, valDetails);
    }

    if (validator.status === "BOND_STATUS_UNBONDING") {
      return createCheck("validator_status", "warn", `Validator ${validator.moniker} is unbonding`, valDetails);
    }

    if (validator.status === "BOND_STATUS_UNBONDED") {
      return createCheck("validator_status", "warn", `Validator ${validator.moniker} is unbonded`, valDetails);
    }

    const score = validator.scores[0]?.score;
    if (score !== undefined && score < 30) {
      return createCheck("validator_status", "warn", `Validator ${validator.moniker} has low score: ${Math.round(score)}/100`, { moniker: validator.moniker, score });
    }

    return createCheck("validator_status", "pass", `Validator ${validator.moniker} is active and bonded`, { ...valDetails, score });
  } catch {
    return createCheck("validator_status", "warn", "Unable to check validator status");
  }
}

function assessOverall(checks: PreflightCheck[]): PreflightStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  const warnCount = checks.filter((c) => c.status === "warn").length;
  if (warnCount >= 2) return "warn";
  return "pass";
}

export async function validatePreflight(params: {
  from: string;
  to: string;
  amount: string;
  denom?: string;
  validatorAddress?: string;
}): Promise<PreflightResponse> {
  const start = Date.now();
  const denom = params.denom ?? "arai";

  const timeoutFallback = (name: string): PreflightCheck => ({
    name,
    status: "warn",
    message: `Check timed out after ${PREFLIGHT.TIMEOUT_MS}ms`,
  });

  // Fetch REST endpoint once for account + balance checks
  const restEndpoint = await prisma.endpoint.findFirst({
    where: { isActive: true, type: "rest" },
    select: { url: true },
  });

  // Run checks in parallel with timeout
  const checkPromises: Promise<PreflightCheck>[] = [
    withTimeout(checkEndpointHealth(), PREFLIGHT.TIMEOUT_MS, timeoutFallback("endpoint_health")),
    withTimeout(checkAccountExists(params.from, restEndpoint), PREFLIGHT.TIMEOUT_MS, timeoutFallback("account_exists")),
    withTimeout(checkBalance(params.from, params.amount, denom, restEndpoint), PREFLIGHT.TIMEOUT_MS, timeoutFallback("balance_check")),
    Promise.resolve(checkGasEstimation(params.amount)),
  ];

  if (params.validatorAddress) {
    checkPromises.push(
      withTimeout(
        checkValidatorStatus(params.validatorAddress),
        PREFLIGHT.TIMEOUT_MS,
        timeoutFallback("validator_status"),
      ),
    );
  }

  const checks = await Promise.all(checkPromises);

  // Risk assessment as final check
  const overallStatus = assessOverall(checks);
  const riskCheck: PreflightCheck = {
    name: "risk_assessment",
    status: overallStatus,
    message:
      overallStatus === "pass"
        ? "All checks passed"
        : overallStatus === "warn"
          ? "Some checks raised warnings"
          : "One or more checks failed",
  };
  checks.push(riskCheck);

  const overall = overallStatus;

  return {
    overall,
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}
