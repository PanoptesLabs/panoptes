"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";
import type {
  YaciDailyTxStats,
  YaciTxSuccessRate,
  YaciMessageTypeStat,
  YaciGasDistribution,
  YaciFeeRevenue,
  YaciBlockMetric,
  YaciNetworkOverview,
  YaciDailyRewards,
} from "@/types";

export function useDailyTxStats() {
  return useSWR<YaciDailyTxStats[]>("/api/stats/tx-daily", pollingSwrConfig);
}

export function useTxSuccessRate() {
  return useSWR<YaciTxSuccessRate>("/api/stats/tx-success-rate", pollingSwrConfig);
}

export function useMessageTypeStats() {
  return useSWR<YaciMessageTypeStat[]>("/api/stats/message-types", pollingSwrConfig);
}

export function useGasDistribution() {
  return useSWR<YaciGasDistribution[]>("/api/stats/gas-distribution", pollingSwrConfig);
}

export function useFeeRevenue() {
  return useSWR<YaciFeeRevenue>("/api/stats/fee-revenue", pollingSwrConfig);
}

export function useBlockMetrics() {
  return useSWR<YaciBlockMetric[]>("/api/stats/block-metrics", pollingSwrConfig);
}

export function useYaciNetworkOverview() {
  return useSWR<YaciNetworkOverview>("/api/stats/network-overview", pollingSwrConfig);
}

export function useDailyRewards() {
  return useSWR<YaciDailyRewards[]>("/api/stats/daily-rewards", pollingSwrConfig);
}
