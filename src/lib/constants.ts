export const APP_NAME = "Panoptes";
export const APP_TAGLINE = "Chain Intelligence, Unblinking.";
export const APP_DESCRIPTION =
  "Chain intelligence platform for Republic AI - Validator monitoring, endpoint health tracking, and smart routing.";
export const APP_VERSION = "0.0.1";

export const REPUBLIC_CHAIN = {
  chainId: "republic-testnet-1",
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
