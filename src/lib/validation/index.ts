import { type ZodType } from "zod";

interface ParseSuccess<T> {
  success: true;
  data: T;
}

interface ParseFailure {
  success: false;
  error: string;
}

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the first error message on failure.
 */
export function parseBody<T>(
  schema: ZodType<T>,
  body: unknown,
): ParseSuccess<T> | ParseFailure {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues;
  const first = issues[0];
  return { success: false, error: first?.message ?? "Validation failed" };
}

export {
  authVerifySchema,
  webhookCreateSchema,
  webhookUpdateSchema,
  sloCreateSchema,
  sloUpdateSchema,
  apiKeyCreateSchema,
} from "./schemas";

export type {
  AuthVerifyInput,
  WebhookCreateInput,
  WebhookUpdateInput,
  SloCreateInput,
  SloUpdateInput,
  ApiKeyCreateInput,
} from "./schemas";
