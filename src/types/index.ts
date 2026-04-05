export type HealthStatus = "healthy" | "degraded" | "down";

export type EndpointType = "rpc" | "rest" | "evm-rpc" | "grpc";

export type ValidatorStatus =
  | "BOND_STATUS_BONDED"
  | "BOND_STATUS_UNBONDING"
  | "BOND_STATUS_UNBONDED";

export type PreflightStatus = "pass" | "warn" | "fail";

// Intelligence Types — re-exported from constants.ts (single source of truth)
import type { AnomalyType, AnomalySeverity, IncidentStatus, IncidentEventType } from "@/lib/constants";
export type { AnomalyType, AnomalySeverity, IncidentStatus, IncidentEventType };

export type AnomalyEntityType = "validator" | "endpoint" | "network";

export interface EndpointScoreItem {
  score: number;
  uptime: number;
  latency: number;
  freshness: number;
  errorRate: number;
  timestamp: string;
}

export interface ValidatorScoreItem {
  score: number;
  missedBlockRate: number;
  jailPenalty: number;
  stakeStability: number;
  commissionScore: number;
  governanceScore: number;
  timestamp: string;
}

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  entityType: AnomalyEntityType;
  entityId: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface AnomalyApiResponse {
  anomalies: AnomalyItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PreflightCheck {
  name: string;
  status: PreflightStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface PreflightResponse {
  overall: PreflightStatus;
  checks: PreflightCheck[];
  timestamp: string;
  duration: number;
}

export interface SmartRouteResponse {
  endpoint: (EndpointItem & { score?: EndpointScoreItem | null }) | null;
  alternatives: (EndpointItem & { score?: EndpointScoreItem | null })[];
  strategy: "score_weighted" | "fallback";
}

// API Response Types

export interface ValidatorListItem {
  id: string;
  moniker: string;
  status: string;
  tokens: string;
  commission: number;
  jailed: boolean;
  uptime: number;
  votingPower: string;
  missedBlocks: number;
  jailCount: number;
  lastJailedAt: string | null;
  firstSeen: string;
  lastUpdated: string;
  score?: ValidatorScoreItem | null;
}

export interface ValidatorApiResponse {
  validators: ValidatorListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ValidatorSnapshotItem {
  id: string;
  tokens: string;
  status: string;
  commission: number;
  jailed: boolean;
  votingPower: string;
  timestamp: string;
}

export interface ValidatorDetailItem extends ValidatorListItem {
  rank?: number | null;
  delegatorCount?: number | null;
  governanceRate?: number | null;
  commissionRewards?: string;
  outstandingRewards?: string;
  consensusPubkey?: string | null;
  consensusAddress?: string | null;
}

export interface ValidatorDetailResponse {
  validator: ValidatorDetailItem;
  snapshots: ValidatorSnapshotItem[];
  snapshotCount: number;
  period: { from: string; to: string };
}

export interface EndpointHealthCheck {
  latencyMs: number;
  statusCode: number;
  isHealthy: boolean;
  blockHeight: string | null;
  error: string | null;
  timestamp: string;
}

export interface EndpointStats24h {
  uptimePercent: number;
  avgLatency: number;
  checkCount: number;
  errorCount: number;
}

export interface EndpointItem {
  id: string;
  url: string;
  type: string;
  provider: string | null;
  isOfficial: boolean;
  latestCheck: EndpointHealthCheck | null;
  stats24h: EndpointStats24h;
  score?: EndpointScoreItem | null;
}

export interface EndpointApiResponse {
  endpoints: EndpointItem[];
}

export interface BestEndpointResponse {
  endpoint: EndpointItem | null;
  alternatives: EndpointItem[];
}

export interface NetworkStatsItem {
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  bondedRatio: number | null;
  blockHeight: string;
  avgBlockTime: number | null;
  inflation: number | null;
  totalSupply: string | null;
  bondedTokens: string | null;
  notBondedTokens: string | null;
  stakingAPR: number | null;
  nakamotoCoefficient: number | null;
  networkHealthScore: number | null;
  timestamp: string;
}

export interface NetworkStatsResponse {
  current: NetworkStatsItem | null;
  history: NetworkStatsItem[];
}

export interface CronResult {
  success: boolean;
  duration: number;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  status: HealthStatus;
  version: string;
  timestamp: string;
  checks: {
    database: { status: HealthStatus; latencyMs: number };
    chain: { status: HealthStatus; blockHeight?: string };
    lastCronRun?: string;
  };
}

// SLO Types
export interface SloItem {
  id: string;
  name: string;
  indicator: string;
  entityType: string;
  entityId: string;
  target: number;
  windowDays: number;
  isActive: boolean;
  isBreaching: boolean;
  currentValue: number | null;
  budgetConsumed: number | null;
  lastEvaluatedAt: string | null;
  createdAt: string;
}

export interface SloSummary {
  total: number;
  active: number;
  breaching: number;
  budgetExhausted: number;
  healthyPct: number;
  slos: SloItem[];
}

// Incident Types
export interface IncidentEventItem {
  id: string;
  incidentId: string;
  eventType: IncidentEventType;
  message: string;
  metadata: string | null;
  createdAt: string;
}

export interface IncidentItem {
  id: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  status: IncidentStatus;
  severity: string;
  title: string;
  description: string;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  events?: IncidentEventItem[];
}

export interface IncidentListResponse {
  incidents: IncidentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface IncidentSummary {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  mttaMinutes: number | null;
  mttrMinutes: number | null;
}

// Webhook Types
export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  secret?: string;
}

export interface WebhookDeliveryItem {
  id: string;
  eventType: string;
  statusCode: number | null;
  success: boolean;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookDeliveryResponse {
  deliveries: WebhookDeliveryItem[];
  total: number;
  limit: number;
  offset: number;
}

// Policy Types
export interface PolicyCondition {
  field: string;
  operator: "lt" | "gt" | "eq" | "neq" | "gte" | "lte" | "in";
  value: number | string | boolean | string[];
}

export interface PolicyAction {
  type: "webhook" | "routing_exclude" | "log" | "annotate" | "incident_create";
  config?: Record<string, unknown>;
}

export interface PolicyItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  dryRun: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface PolicyExecutionItem {
  id: string;
  policyId: string;
  triggerEntity: string;
  conditionsMet: PolicyCondition[];
  actionsTaken: PolicyAction[];
  actionsResults: Record<string, unknown>[];
  dryRun: boolean;
  timestamp: string;
}

// Governance Types
export interface GovernanceProposalItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  proposer: string | null;
  submitTime: string | null;
  votingStartTime: string | null;
  votingEndTime: string | null;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  vetoVotes: string;
}

export interface GovernanceVoteItem {
  id: string;
  proposalId: string;
  voter: string;
  option: string;
  votedAt: string | null;
}

// Delegation Types
export interface DelegationEventItem {
  id: string;
  type: "delegate" | "undelegate" | "redelegate";
  delegator: string;
  validatorFrom: string | null;
  validatorTo: string;
  amount: string;
  timestamp: string;
}

// Compute Types
export interface ComputeJob {
  job_id: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  creator: string;
  target_validator: string;
  execution_image: string;
  verification_image: string | null;
  fee_amount: string;
  fee_denom: string;
  result_hash: string | null;
  result_fetch_endpoint: string | null;
  result_upload_endpoint: string | null;
  submit_tx_hash: string | null;
  submit_height: number | null;
  submit_time: string | null;
  result_tx_hash: string | null;
  result_height: number | null;
  result_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComputeStats {
  total_jobs: number;
  pending_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
}

export interface ComputeLeaderboardEntry {
  target_validator: string;
  moniker: string;
  total_jobs: number;
  completed_jobs: number;
  success_rate: number;
}

export interface DelegationSnapshotItem {
  id: string;
  validatorId: string;
  totalDelegators: number;
  totalDelegated: string;
  churnRate: number;
  timestamp: string;
}
