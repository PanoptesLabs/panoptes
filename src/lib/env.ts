import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEBHOOK_ENCRYPTION_KEY: z
    .string()
    .length(64, "WEBHOOK_ENCRYPTION_KEY must be 64 hex characters")
    .regex(/^[0-9a-f]+$/i, "WEBHOOK_ENCRYPTION_KEY must be hex"),
  STREAM_TOKEN_SECRET: z
    .string()
    .length(64, "STREAM_TOKEN_SECRET must be 64 hex characters")
    .regex(/^[0-9a-f]+$/i, "STREAM_TOKEN_SECRET must be hex"),
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  YACI_EXPLORER_BASE_URL: z
    .string()
    .url()
    .default("https://yaci-explorer-apis.fly.dev"),
});

/**
 * Validate required environment variables at startup.
 * Skipped in test environment.
 */
export function validateEnv(): void {
  if (process.env.NODE_ENV === "test") return;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${errors}`);
  }
}
