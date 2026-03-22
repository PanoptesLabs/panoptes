/**
 * Shared types for intelligence modules.
 */

/** Endpoint with health check data — used by forecasting and anomaly detection. */
export interface EndpointWithHealthChecks {
  id: string;
  url?: string;
  type?: string;
  isActive?: boolean;
  isOfficial?: boolean;
  healthChecks: {
    timestamp: Date;
    isHealthy: boolean;
    latencyMs?: number;
    blockHeight?: bigint | null;
  }[];
}

/** Validator with recent snapshots — used by anomaly detection. */
export type ValidatorWithSnapshots = {
  id: string;
  moniker: string;
  tokens: string;
  jailed: boolean;
  snapshots: {
    timestamp: Date;
    tokens: string;
    commission: number;
    jailed: boolean;
  }[];
};
