import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export type StepError = { step: string; error: string };

export async function runStep<T>(
  name: string,
  fn: () => Promise<T>,
  errors: StepError[],
  logPrefix = "Cron",
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`${logPrefix}: ${name}`, msg);
    errors.push({ step: name, error: msg });
    return null;
  }
}

/**
 * Wrapper for simple single-function cron routes.
 * Handles auth, rate limiting, error formatting.
 */
export async function runSingleCron<T>(
  request: NextRequest,
  name: string,
  fn: () => Promise<T>,
): Promise<NextResponse> {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  try {
    const result = await fn();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Cron ${name}`, error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
