"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";

interface LeaderboardEntry {
  rank: number;
  validatorId: string;
  moniker: string;
  value: number;
  score: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  category: string;
  limit: number;
}

interface CompareResult {
  validatorId: string;
  moniker: string;
  metrics: {
    uptime: number;
    commission: number;
    governance: number;
    stakeStability: number;
    score: number;
  };
}

interface CompareResponse {
  results: CompareResult[];
}

interface TrendPoint {
  timestamp: string;
  score: number;
}

interface TrendResponse {
  validatorId: string;
  period: string;
  trend: TrendPoint[];
}

export function useLeaderboard(category?: string, limit?: number) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (limit) params.set("limit", String(limit));

  const query = params.toString();
  const url = `/api/validators/leaderboard${query ? `?${query}` : ""}`;

  return useSWR<LeaderboardResponse>(url, pollingSwrConfig);
}

export function useValidatorCompare(ids: string[]) {
  const url = ids.length > 0
    ? `/api/validators/compare?ids=${ids.join(",")}`
    : null;

  return useSWR<CompareResponse>(url, pollingSwrConfig);
}

export function useScoreTrend(id: string | null, period?: string) {
  const params = new URLSearchParams();
  if (id) params.set("id", id);
  if (period) params.set("period", period);

  const url = id ? `/api/validators/trends?${params.toString()}` : null;

  return useSWR<TrendResponse>(url, pollingSwrConfig);
}
