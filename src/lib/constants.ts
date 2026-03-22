export const APP_NAME = "Panoptes";
export const APP_TAGLINE = "Chain Intelligence, Unblinking.";
export const APP_DESCRIPTION =
  "Chain intelligence platform for Republic AI - Validator monitoring, endpoint health tracking, and smart routing.";
export const APP_VERSION = "0.4.0";

export const REPUBLIC_CHAIN = {
  chainId: "raitestnet_77701-1",
  rpcUrl: process.env.REPUBLIC_RPC_URL || "https://rpc.republicai.io",
  restUrl: process.env.REPUBLIC_REST_URL || "https://rest.republicai.io",
} as const;

export const CRON_INTERVALS = {
  HEALTH_CHECK: 5,
  VALIDATOR_SYNC: 5,
  STATS_AGGREGATE: 15,
  CLEANUP: 1440,
} as const;

export const RETENTION = {
  VALIDATOR_SNAPSHOTS: 90,
  ENDPOINT_HEALTH: 7,
  NETWORK_STATS: 90,
} as const;

export const KNOWN_ENDPOINTS = [
  {
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://rest.republicai.io",
    type: "rest",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://evm-rpc.republicai.io",
    type: "evm-rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
] as const;

export const API_DEFAULTS = {
  VALIDATORS_LIMIT: 50,
  VALIDATORS_MAX: 200,
  SNAPSHOTS_LIMIT: 100,
  SNAPSHOTS_MAX: 500,
  DEFAULT_DAYS: 7,
} as const;

export const RATE_LIMIT = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS: 60,
  CLEANUP_INTERVAL: 300_000,
} as const;

export const HEALTH_THRESHOLDS = {
  LATENCY_HEALTHY_MS: 5000,
  BLOCK_HEIGHT_STALE: 10,
  ENDPOINT_TIMEOUT_MS: 5000,
} as const;

export const SCORING = {
  ENDPOINT_WEIGHTS: {
    uptime: 0.40,
    latency: 0.25,
    freshness: 0.20,
    errorRate: 0.15,
  },
  VALIDATOR_WEIGHTS: {
    missedBlockRate: 0.40,
    jailPenalty: 0.25,
    stakeStability: 0.10,
    commissionScore: 0.10,
    governanceScore: 0.15,
  },
  EMA_ALPHA: 0.3,
  LATENCY_BASELINE_MS: 200,
  LATENCY_MAX_MS: 5000,
  JAIL_PENALTY_MULTIPLIER: 0.25,
  JAIL_RECENT_DAYS: 7,
  RELIABLE_WEIGHTS: {
    uptimeWeight: 0.5,
    jailWeight: 0.3,
    stabilityWeight: 0.2,
  },
} as const;

export const ANOMALY_TYPES = [
  "jailing",
  "large_stake_change",
  "commission_spike",
  "endpoint_down",
  "block_stale",
  "mass_unbonding",
  "whale_movement",
] as const;

export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const ANOMALY_THRESHOLDS = {
  LARGE_STAKE_CHANGE_PCT: 10,
  COMMISSION_SPIKE_PCT: 5,
  ENDPOINT_DOWN_CONSECUTIVE: 3,
  BLOCK_STALE_BEHIND: 10,
  MASS_UNBONDING_PCT: 5,
  WHALE_MOVEMENT_PCT: 1,
  WHALE_CRITICAL_PCT: 5,
} as const;

export const PREFLIGHT = {
  MIN_GAS_BALANCE: "1000",
  DEFAULT_GAS_LIMIT: 200_000,
  TIMEOUT_MS: 10_000,
  FETCH_TIMEOUT_MS: 5_000,
} as const;

export const WORKSPACE_DEFAULTS = {
  MAX_WORKSPACES: 50,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  SLUG_MIN_LENGTH: 2,
  SLUG_MAX_LENGTH: 50,
  SLUG_PATTERN: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
} as const;

export const WEBHOOK_EVENTS = [
  "anomaly.created",
  "anomaly.resolved",
  "validator.jailed",
  "validator.unjailed",
  "validator.status_changed",
  "endpoint.down",
  "endpoint.recovered",
  "stats.updated",
  "slo.breached",
  "slo.budget_exhausted",
  "slo.recovered",
  "incident.created",
  "incident.acknowledged",
  "incident.resolved",
  "policy.triggered",
  "policy.action_executed",
  "governance.proposal_created",
  "governance.voting_started",
  "governance.voting_ended",
  "delegation.whale_detected",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_DEFAULTS = {
  MAX_PER_WORKSPACE: 10,
  MAX_EVENTS: 20,
  SECRET_PREFIX: "whsec_",
} as const;

export const SLO_INDICATORS = [
  "uptime",
  "latency",
  "error_rate",
  "block_production",
] as const;

export type SloIndicator = (typeof SLO_INDICATORS)[number];

export const SLO_ENTITY_TYPES = ["endpoint", "validator"] as const;
export type SloEntityType = (typeof SLO_ENTITY_TYPES)[number];

export const SLO_INDICATOR_ENTITY_MAP: Record<SloIndicator, readonly SloEntityType[]> = {
  uptime: ["endpoint"],
  latency: ["endpoint"],
  error_rate: ["endpoint"],
  block_production: ["validator"],
} as const;

export const SLO_DEFAULTS = {
  MAX_PER_WORKSPACE: 20,
  MIN_TARGET: 0.9,
  MAX_TARGET: 0.9999,
  MIN_WINDOW_DAYS: 1,
  MAX_WINDOW_DAYS: 7,
} as const;

export const SLO_RETENTION = {
  EVALUATION_DAYS: 90,
} as const;

export const INCIDENT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_EVENT_TYPES = [
  "created", "slo_linked", "anomaly_linked",
  "acknowledged", "resolved", "comment",
] as const;
export type IncidentEventType = (typeof INCIDENT_EVENT_TYPES)[number];

export const INCIDENT_DEFAULTS = {
  MAX_OPEN_PER_WORKSPACE: 100,
  CORRELATION_WINDOW_HOURS: 1,
} as const;

export const INCIDENT_RETENTION = {
  RESOLVED_DAYS: 90,
} as const;

export const STREAM_DEFAULTS = {
  POLL_INTERVAL_MS: 3_000,
  HEARTBEAT_MS: 15_000,
  BATCH_SIZE: 50,
  TOKEN_TTL_SECONDS: 300,
} as const;

export const OUTBOX_RETENTION = {
  HOURS: 24,
} as const;

export const WEBHOOK_DISPATCH = {
  BATCH_SIZE: 50,
  RETRY_BATCH_SIZE: 20,
  TIMEOUT_MS: 5_000,
  MAX_ATTEMPTS: 5,
  RETRY_DELAYS_S: [30, 120, 600, 3_600, 21_600],
  BUDGET_MS: 45_000,
  STALE_CLAIM_MS: 300_000,
} as const;

export const DELIVERY_RETENTION = {
  SUCCESS_DAYS: 7,
  FAILURE_DAYS: 30,
} as const;

export const POLICY_OPERATORS = ["lt", "gt", "eq", "neq", "gte", "lte", "in"] as const;
export type PolicyOperator = (typeof POLICY_OPERATORS)[number];

export const POLICY_ACTION_TYPES = ["webhook", "routing_exclude", "log", "annotate", "incident_create"] as const;
export type PolicyActionType = (typeof POLICY_ACTION_TYPES)[number];

export const POLICY_DEFAULTS = {
  MAX_PER_WORKSPACE: 20,
  MIN_COOLDOWN_MINUTES: 1,
  MAX_COOLDOWN_MINUTES: 1440,
  MAX_CONDITIONS: 10,
  MAX_ACTIONS: 5,
} as const;

export const REMEDIATION_DEFAULTS = {
  MAX_ACTIONS_PER_HOUR: 10,
  MIN_HEALTHY_ENDPOINTS: 2,
  DEFAULT_EXPIRY_HOURS: 1,
} as const;

export const VALIDATOR_DEFAULTS = {
  VALIDATOR_FETCH_LIMIT: 200,
  FETCH_TIMEOUT_MS: 15_000,
} as const;

export const GOVERNANCE_DEFAULTS = {
  SYNC_BATCH_SIZE: 50,
  PROPOSAL_FETCH_LIMIT: 100,
  VOTE_FETCH_LIMIT: 500,
  FETCH_TIMEOUT_MS: 10_000,
} as const;

export const DELEGATION_DEFAULTS = {
  SNAPSHOT_TOP_DELEGATORS: 10,
  DELEGATION_FETCH_LIMIT: 500,
  FETCH_TIMEOUT_MS: 10_000,
} as const;

export const API_KEY_TIERS = {
  anonymous: { rateLimit: 30, dailyQuota: 500, monthlyQuota: 0 },
  free:      { rateLimit: 60, dailyQuota: 1000, monthlyQuota: 10000 },
  pro:       { rateLimit: 300, dailyQuota: 50000, monthlyQuota: 500000 },
} as const;

export type ApiKeyTier = keyof typeof API_KEY_TIERS;

export const API_KEY_DEFAULTS = {
  MAX_PER_WORKSPACE: 10,
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  KEY_PREFIX: "pk_",
} as const;

export const CONTROL_PLANE_RETENTION = {
  DELEGATION_EVENTS_DAYS: 30,
  DELEGATION_SNAPSHOTS_DAYS: 30,
  POLICY_EXECUTIONS_DAYS: 30,
} as const;

export const FORECAST_DEFAULTS = {
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 20,
  CONFIDENCE_MIN: 0,
  CONFIDENCE_MAX: 95,
  RETENTION_DAYS: 7,
  TIME_HORIZONS: ["1h", "6h", "24h"] as const,
  METRICS: ["latency", "jail_risk", "downtime", "unbonding", "breach_risk"] as const,
} as const;

export const FORECAST_THRESHOLDS = {
  LATENCY_CRITICAL_MS: 10_000,
  LATENCY_WARNING_MS: 5_000,
  JAIL_RISK_CRITICAL: 0.8,
  JAIL_RISK_WARNING: 0.5,
  DOWNTIME_CRITICAL_FAILURES: 5,
  DOWNTIME_WARNING_FAILURES: 3,
  UNBONDING_CRITICAL_PCT: -25,
  UNBONDING_WARNING_PCT: -10,
  SLO_BREACH_CRITICAL_HOURS: 6,
  SLO_BREACH_WARNING_HOURS: 24,
  MIN_SAMPLE_SIZE: 20,
} as const;

export const LEADERBOARD_DEFAULTS = {
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 20,
  MAX_COMPARE: 5,
  TREND_PERIODS: ["7d", "30d", "90d"] as const,
} as const;

export const AUTH_DEFAULTS = {
  SESSION_DURATION_DAYS: 7,
  NONCE_EXPIRY_MINUTES: 5,
  PUBLIC_WORKSPACE_SLUG: "republic",
  COOKIE_NAME: "__Host-panoptes_session",
} as const;

export const ROLES = {
  ANONYMOUS: "anonymous",
  VIEWER: "viewer",
  MEMBER: "member",
  EDITOR: "editor",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<string, number> = {
  anonymous: 0,
  viewer: 1,
  member: 2,
  editor: 3,
  admin: 4,
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  high: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  medium: "bg-orange-900/50 text-orange-300 border-orange-500/30",
  low: "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  acknowledged: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  resolved: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30",
};

export const SEVERITY_BADGE_COLORS: Record<string, string> = {
  critical: "bg-rose-DEFAULT/15 text-rose-DEFAULT",
  high: "bg-amber-DEFAULT/15 text-amber-DEFAULT",
  medium: "bg-soft-violet/15 text-soft-violet",
  low: "bg-dusty-lavender/15 text-dusty-lavender/70",
};

export const STATUS_BADGE_COLORS: Record<string, string> = {
  open: "bg-rose-DEFAULT/15 text-rose-DEFAULT",
  acknowledged: "bg-amber-DEFAULT/15 text-amber-DEFAULT",
  resolved: "bg-teal-DEFAULT/15 text-teal-DEFAULT",
};
