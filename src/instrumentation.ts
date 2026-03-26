import { validateEnv } from "@/lib/env";

export function register() {
  try {
    validateEnv();
  } catch (err) {
    console.error("[instrumentation]", err instanceof Error ? err.message : err);
  }
}
