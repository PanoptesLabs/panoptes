import { POLICY_DEFAULTS, POLICY_OPERATORS, POLICY_ACTION_TYPES } from "@/lib/constants";
import { ALLOWED_FIELDS } from "@/lib/intelligence/policy-conditions";
import type { PolicyCondition, PolicyAction } from "@/types";

/**
 * Validate an array of policy conditions.
 * Returns error string if invalid, null if valid.
 */
export function validateConditions(conditions: unknown[]): string | null {
  if (conditions.length === 0) {
    return "At least one condition is required";
  }
  if (conditions.length > POLICY_DEFAULTS.MAX_CONDITIONS) {
    return `Maximum ${POLICY_DEFAULTS.MAX_CONDITIONS} conditions allowed`;
  }
  for (const c of conditions) {
    if (!c || typeof c !== "object" || !(c as Record<string, unknown>).field || !(c as Record<string, unknown>).operator || (c as Record<string, unknown>).value === undefined) {
      return "Each condition must have field, operator, and value";
    }
    const cond = c as Record<string, unknown>;
    if (!(POLICY_OPERATORS as readonly string[]).includes(cond.operator as string)) {
      return `Invalid operator: ${cond.operator}`;
    }
    if (!ALLOWED_FIELDS.has(cond.field as string)) {
      return `Invalid condition field: ${cond.field}`;
    }
  }
  return null;
}

/**
 * Validate an array of policy actions.
 * Returns error string if invalid, null if valid.
 */
export function validateActions(actions: unknown[]): string | null {
  if (actions.length === 0) {
    return "At least one action is required";
  }
  if (actions.length > POLICY_DEFAULTS.MAX_ACTIONS) {
    return `Maximum ${POLICY_DEFAULTS.MAX_ACTIONS} actions allowed`;
  }
  for (const a of actions) {
    if (!a || typeof a !== "object" || !(POLICY_ACTION_TYPES as readonly string[]).includes((a as Record<string, unknown>).type as string)) {
      return `Invalid action type: ${(a as Record<string, unknown>)?.type}`;
    }
  }
  return null;
}

/**
 * Validate cooldown minutes.
 * Returns error string if invalid, null if valid.
 */
export function validateCooldown(cooldownMinutes: number): string | null {
  if (cooldownMinutes < POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES ||
      cooldownMinutes > POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES) {
    return `Cooldown must be between ${POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES} and ${POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES} minutes`;
  }
  return null;
}

/**
 * Validate a full policy create request body.
 */
export function validatePolicyCreate(body: unknown): {
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  dryRun?: boolean;
  priority?: number;
  cooldownMinutes?: number;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };

  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length < 2) {
    return { error: "Name must be at least 2 characters" };
  }

  if (!Array.isArray(b.conditions)) {
    return { error: "At least one condition is required" };
  }
  const condErr = validateConditions(b.conditions);
  if (condErr) return { error: condErr };

  if (!Array.isArray(b.actions)) {
    return { error: "At least one action is required" };
  }
  const actErr = validateActions(b.actions);
  if (actErr) return { error: actErr };

  if (b.cooldownMinutes !== undefined) {
    if (typeof b.cooldownMinutes !== "number") {
      return { error: "Cooldown must be a number" };
    }
    const cdErr = validateCooldown(b.cooldownMinutes);
    if (cdErr) return { error: cdErr };
  }

  return {
    name: b.name.trim(),
    description: typeof b.description === "string" ? b.description.trim() : undefined,
    conditions: b.conditions as PolicyCondition[],
    actions: b.actions as PolicyAction[],
    dryRun: typeof b.dryRun === "boolean" ? b.dryRun : undefined,
    priority: typeof b.priority === "number" ? b.priority : undefined,
    cooldownMinutes: b.cooldownMinutes as number | undefined,
  };
}

/**
 * Safely parse JSON with a fallback value.
 * Used for DB-stored JSON strings that could theoretically be corrupted.
 */
export function safeParseJSON(value: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
