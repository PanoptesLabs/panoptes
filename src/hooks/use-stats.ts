"use client";

import useSWR from "swr";
import { pollingSwrConfig, defaultSwrConfig } from "./use-api";
import type { NetworkStatsResponse, HealthCheckResult } from "@/types";

export function useNetworkStats() {
  return useSWR<NetworkStatsResponse>("/api/stats", pollingSwrConfig);
}

export function useHealth() {
  return useSWR<HealthCheckResult>("/api/health", defaultSwrConfig);
}
