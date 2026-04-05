import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { fetchYaci, parseModelName } from "@/lib/yaci";
import type { ComputeLeaderboardEntry, ComputeJob } from "@/types";

// Yaci returns flat arrays for these endpoints
type YaciLeaderboardResponse = ComputeLeaderboardEntry[];
type YaciJobsResponse = ComputeJob[];
// select=execution_image returns partial objects (for model list only)
type YaciModelJob = Pick<ComputeJob, "execution_image">;

interface ValidatorComputeResponse {
  stats: {
    total_jobs: number;
    completed_jobs: number;
    success_rate: number;
  } | null;
  models: string[];
  recentJobs: ComputeJob[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { id } = await params;
  const encoded = encodeURIComponent(id);

  const [leaderboardResult, jobsResult, modelsResult] = await Promise.all([
    fetchYaci<YaciLeaderboardResponse>("/compute_leaderboard"),
    fetchYaci<YaciJobsResponse>(
      `/compute_jobs?target_validator=eq.${encoded}&limit=20&order=created_at.desc`,
    ),
    fetchYaci<YaciModelJob[]>(
      `/compute_jobs?target_validator=eq.${encoded}&select=execution_image&limit=1000&order=created_at.desc`,
    ),
  ]);

  // If all three upstream calls failed, signal upstream error
  if (!leaderboardResult.ok && !jobsResult.ok && !modelsResult.ok) {
    return jsonResponse(
      { error: "Compute data temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const leaderboard = leaderboardResult.ok ? leaderboardResult.data : [];
  const entry = leaderboard.find((e) => e.target_validator === id) ?? null;

  // Only expose metrics the upstream API provides as reliable aggregates.
  // The leaderboard gives us total_jobs, completed_jobs, success_rate.
  // Per-status breakdowns (failed/pending) are NOT available as aggregates
  // from the upstream API, so we intentionally omit them rather than show
  // misleading numbers derived from a capped sample.
  const stats: ValidatorComputeResponse["stats"] = entry
    ? {
        total_jobs: entry.total_jobs,
        completed_jobs: entry.completed_jobs,
        success_rate: entry.success_rate,
      }
    : null;

  const models = [
    ...new Set(
      (modelsResult.ok ? modelsResult.data : [])
        .map((j) => parseModelName(j.execution_image))
        .filter(Boolean),
    ),
  ];

  const recentJobs = jobsResult.ok ? jobsResult.data : [];

  const body: ValidatorComputeResponse = { stats, models, recentJobs };

  return jsonResponse(body, rl.headers, 200, {
    sMaxAge: 60,
    staleWhileRevalidate: 120,
  });
}
