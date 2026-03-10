import { prisma } from "@/lib/db";
import { PREFLIGHT } from "@/lib/constants";
import type { PreflightCheck, PreflightResponse, PreflightStatus } from "@/types";

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
      return {
        name: "endpoint_health",
        status: "warn",
        message: "No scored endpoints available",
      };
    }

    const score = bestEndpoint.score;
    let status: PreflightStatus = "pass";
    if (score < 50) status = "fail";
    else if (score < 70) status = "warn";

    return {
      name: "endpoint_health",
      status,
      message: `Best RPC endpoint score: ${Math.round(score)}/100 (${bestEndpoint.endpoint.url})`,
      details: { endpointUrl: bestEndpoint.endpoint.url, score },
    };
  } catch {
    return {
      name: "endpoint_health",
      status: "warn",
      message: "Unable to check endpoint health",
    };
  }
}

async function checkAccountExists(address: string): Promise<PreflightCheck> {
  try {
    // Query REST endpoint for account info
    const restEndpoint = await prisma.endpoint.findFirst({
      where: { isActive: true, type: "rest" },
    });

    if (!restEndpoint) {
      return {
        name: "account_exists",
        status: "warn",
        message: "No REST endpoint available to verify account",
      };
    }

    const res = await fetch(
      `${restEndpoint.url}/cosmos/auth/v1beta1/accounts/${address}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (res.ok) {
      return {
        name: "account_exists",
        status: "pass",
        message: `Account ${address} found on chain`,
      };
    }

    return {
      name: "account_exists",
      status: "warn",
      message: "Account not found on chain, may be new",
    };
  } catch {
    return {
      name: "account_exists",
      status: "warn",
      message: "Unable to verify account existence",
    };
  }
}

async function checkBalance(
  address: string,
  amount: string,
  denom: string,
): Promise<PreflightCheck> {
  try {
    const restEndpoint = await prisma.endpoint.findFirst({
      where: { isActive: true, type: "rest" },
    });

    if (!restEndpoint) {
      return {
        name: "balance_check",
        status: "warn",
        message: "No REST endpoint available to check balance",
      };
    }

    const res = await fetch(
      `${restEndpoint.url}/cosmos/bank/v1beta1/balances/${address}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return {
        name: "balance_check",
        status: "warn",
        message: "Unable to fetch balance",
      };
    }

    const data = await res.json();
    const balances = data.balances || [];
    const tokenBalance = balances.find(
      (b: { denom: string; amount: string }) => b.denom === denom,
    );
    const balance = BigInt(tokenBalance?.amount ?? "0");
    const required = BigInt(amount);
    const gasEstimate = BigInt(PREFLIGHT.DEFAULT_GAS_LIMIT);

    if (balance >= required + gasEstimate) {
      return {
        name: "balance_check",
        status: "pass",
        message: `Sufficient balance: ${balance} ${denom} (need ${required} + ~${gasEstimate} gas)`,
        details: { balance: balance.toString(), required: amount, denom },
      };
    }

    if (balance >= required) {
      return {
        name: "balance_check",
        status: "warn",
        message: `Balance covers amount but gas may be insufficient: ${balance} ${denom}`,
        details: { balance: balance.toString(), required: amount, denom },
      };
    }

    return {
      name: "balance_check",
      status: "fail",
      message: `Insufficient balance: ${balance} ${denom} (need ${required})`,
      details: { balance: balance.toString(), required: amount, denom },
    };
  } catch {
    return {
      name: "balance_check",
      status: "warn",
      message: "Unable to verify balance",
    };
  }
}

function checkGasEstimation(amount: string): PreflightCheck {
  const gasEstimate = PREFLIGHT.DEFAULT_GAS_LIMIT;

  return {
    name: "gas_estimation",
    status: "pass",
    message: `Estimated gas limit: ${gasEstimate}`,
    details: { gasLimit: gasEstimate, amount },
  };
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
      return {
        name: "validator_status",
        status: "warn",
        message: `Validator ${validatorAddress} not found in database`,
      };
    }

    if (validator.jailed) {
      return {
        name: "validator_status",
        status: "fail",
        message: `Validator ${validator.moniker} is jailed`,
        details: { moniker: validator.moniker, status: validator.status },
      };
    }

    if (validator.status === "BOND_STATUS_UNBONDING") {
      return {
        name: "validator_status",
        status: "warn",
        message: `Validator ${validator.moniker} is unbonding`,
        details: { moniker: validator.moniker, status: validator.status },
      };
    }

    if (validator.status === "BOND_STATUS_UNBONDED") {
      return {
        name: "validator_status",
        status: "warn",
        message: `Validator ${validator.moniker} is unbonded`,
        details: { moniker: validator.moniker, status: validator.status },
      };
    }

    const score = validator.scores[0]?.score;
    if (score !== undefined && score < 30) {
      return {
        name: "validator_status",
        status: "warn",
        message: `Validator ${validator.moniker} has low score: ${Math.round(score)}/100`,
        details: { moniker: validator.moniker, score },
      };
    }

    return {
      name: "validator_status",
      status: "pass",
      message: `Validator ${validator.moniker} is active and bonded`,
      details: { moniker: validator.moniker, status: validator.status, score },
    };
  } catch {
    return {
      name: "validator_status",
      status: "warn",
      message: "Unable to check validator status",
    };
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
  const denom = params.denom ?? "aRAI";

  const timeoutFallback = (name: string): PreflightCheck => ({
    name,
    status: "warn",
    message: `Check timed out after ${PREFLIGHT.TIMEOUT_MS}ms`,
  });

  // Run checks in parallel with timeout
  const checkPromises: Promise<PreflightCheck>[] = [
    withTimeout(checkEndpointHealth(), PREFLIGHT.TIMEOUT_MS, timeoutFallback("endpoint_health")),
    withTimeout(checkAccountExists(params.from), PREFLIGHT.TIMEOUT_MS, timeoutFallback("account_exists")),
    withTimeout(checkBalance(params.from, params.amount, denom), PREFLIGHT.TIMEOUT_MS, timeoutFallback("balance_check")),
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
  const riskCheck: PreflightCheck = {
    name: "risk_assessment",
    status: assessOverall(checks),
    message:
      assessOverall(checks) === "pass"
        ? "All checks passed"
        : assessOverall(checks) === "warn"
          ? "Some checks raised warnings"
          : "One or more checks failed",
  };
  checks.push(riskCheck);

  const overall = assessOverall(checks);

  return {
    overall,
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}
