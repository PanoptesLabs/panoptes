import { z } from "zod";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_DEFAULTS,
  SLO_INDICATORS,
  SLO_ENTITY_TYPES,
  SLO_DEFAULTS,
  API_KEY_DEFAULTS,
} from "@/lib/constants";

// --- Auth ---

export const authVerifySchema = z.object({
  address: z.string().min(1, "address is required"),
  pubKey: z.string().min(1, "pubKey is required"),
  signature: z.string().min(1, "signature is required"),
  sessionId: z.string().min(1, "sessionId is required"),
});

export type AuthVerifyInput = z.infer<typeof authVerifySchema>;

// --- Webhook ---

const webhookEventEnum = z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]]);

export const webhookCreateSchema = z.object({
  name: z
    .string()
    .min(1, "name is required and must be a non-empty string")
    .max(100, "name must be at most 100 characters")
    .transform((v) => v.trim()),
  url: z
    .string()
    .min(1, "url is required and must be a non-empty string")
    .url("url must be a valid URL")
    .transform((v) => v.trim()),
  events: z
    .array(webhookEventEnum)
    .min(1, "events must be a non-empty array")
    .max(WEBHOOK_DEFAULTS.MAX_EVENTS, `events must have at most ${WEBHOOK_DEFAULTS.MAX_EVENTS} items`),
});

export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;

export const webhookUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, "name must be a non-empty string")
      .max(100, "name must be at most 100 characters")
      .transform((v) => v.trim())
      .optional(),
    url: z
      .string()
      .min(1, "url must be a non-empty string")
      .url("url must be a valid URL")
      .transform((v) => v.trim())
      .optional(),
    events: z
      .array(webhookEventEnum)
      .min(1, "events must be a non-empty array")
      .max(WEBHOOK_DEFAULTS.MAX_EVENTS, `events must have at most ${WEBHOOK_DEFAULTS.MAX_EVENTS} items`)
      .optional(),
    isActive: z.boolean({ error: "isActive must be a boolean" }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type WebhookUpdateInput = z.infer<typeof webhookUpdateSchema>;

// --- SLO ---

const sloIndicatorEnum = z.enum(SLO_INDICATORS as unknown as [string, ...string[]]);
const sloEntityTypeEnum = z.enum(SLO_ENTITY_TYPES as unknown as [string, ...string[]]);

export const sloCreateSchema = z.object({
  name: z
    .string()
    .min(1, "name is required and must be a non-empty string")
    .max(100, "name must be at most 100 characters")
    .transform((v) => v.trim()),
  indicator: sloIndicatorEnum,
  entityType: sloEntityTypeEnum,
  entityId: z
    .string()
    .min(1, "entityId is required and must be a non-empty string")
    .transform((v) => v.trim()),
  target: z
    .number({ error: "target is required and must be a number" })
    .min(SLO_DEFAULTS.MIN_TARGET, `target must be at least ${SLO_DEFAULTS.MIN_TARGET}`)
    .max(SLO_DEFAULTS.MAX_TARGET, `target must be at most ${SLO_DEFAULTS.MAX_TARGET}`),
  windowDays: z
    .number({ error: "windowDays is required and must be a number" })
    .int("windowDays must be an integer")
    .min(SLO_DEFAULTS.MIN_WINDOW_DAYS, `windowDays must be at least ${SLO_DEFAULTS.MIN_WINDOW_DAYS}`)
    .max(SLO_DEFAULTS.MAX_WINDOW_DAYS, `windowDays must be at most ${SLO_DEFAULTS.MAX_WINDOW_DAYS}`),
});

export type SloCreateInput = z.infer<typeof sloCreateSchema>;

export const sloUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, "name must be a non-empty string")
      .max(100, "name must be at most 100 characters")
      .transform((v) => v.trim())
      .optional(),
    target: z
      .number()
      .min(SLO_DEFAULTS.MIN_TARGET)
      .max(SLO_DEFAULTS.MAX_TARGET)
      .optional(),
    windowDays: z
      .number()
      .int()
      .min(SLO_DEFAULTS.MIN_WINDOW_DAYS)
      .max(SLO_DEFAULTS.MAX_WINDOW_DAYS)
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type SloUpdateInput = z.infer<typeof sloUpdateSchema>;

// --- API Key ---

export const apiKeyCreateSchema = z.object({
  name: z
    .string()
    .min(API_KEY_DEFAULTS.NAME_MIN_LENGTH, `Name must be at least ${API_KEY_DEFAULTS.NAME_MIN_LENGTH} character`)
    .max(API_KEY_DEFAULTS.NAME_MAX_LENGTH, `Name must be at most ${API_KEY_DEFAULTS.NAME_MAX_LENGTH} characters`)
    .transform((v) => v.trim()),
  tier: z.enum(["free", "pro"]).default("free"),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable(),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
