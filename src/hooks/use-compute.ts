"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";
import type {
  ComputeJob,
  ComputeStats,
  ComputeLeaderboardEntry,
} from "@/types";

// ── Validator Compute ──

interface ValidatorComputeResponse {
  stats: {
    total_jobs: number;
    completed_jobs: number;
    success_rate: number;
  } | null;
  models: string[];
  recentJobs: ComputeJob[];
}

export function useValidatorCompute(validatorId: string | null) {
  const url = validatorId ? `/api/compute/validator/${validatorId}` : null;
  return useSWR<ValidatorComputeResponse>(url, pollingSwrConfig);
}

// ── Compute Leaderboard ──

interface ComputeLeaderboardResponse {
  entries: ComputeLeaderboardEntry[];
}

export function useComputeLeaderboard(limit = 100) {
  return useSWR<ComputeLeaderboardResponse>(
    `/api/compute/leaderboard?limit=${limit}`,
    pollingSwrConfig,
  );
}

// ── Network Compute Stats ──

export function useComputeStats() {
  return useSWR<ComputeStats>("/api/compute/stats", pollingSwrConfig);
}

// ── Compute Jobs Explorer ──

interface ComputeJobsListResponse {
  jobs: ComputeJob[];
  total: number;
  limit: number;
  offset: number;
}

export function useComputeJobs(opts?: {
  status?: string;
  validator?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.validator) params.set("validator", opts.validator);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));

  const query = params.toString();
  const url = `/api/compute/jobs${query ? `?${query}` : ""}`;

  return useSWR<ComputeJobsListResponse>(url, pollingSwrConfig);
}
