// Shared TypeScript types for Panoptes
// Will be populated in Phase 1+

export type HealthStatus = "healthy" | "degraded" | "down";

export type EndpointType = "rpc" | "rest" | "evm-rpc" | "grpc";

export type ValidatorStatus =
  | "BOND_STATUS_BONDED"
  | "BOND_STATUS_UNBONDING"
  | "BOND_STATUS_UNBONDED";

export type PreflightStatus = "pass" | "warn" | "fail";
