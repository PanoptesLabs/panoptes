import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseStringParam } from "@/lib/validation";
import { fetchYaci } from "@/lib/yaci";
import type { ComputeJob, ComputeLeaderboardEntry } from "@/types";

type MonikerEntry = Pick<ComputeLeaderboardEntry, "target_validator" | "moniker">;

// RPC endpoint returns { data, pagination } — we only need pagination.total
interface RpcCountResponse {
  data: unknown[];
  pagination: { total: number };
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;
  const limit = parseIntParam(params.get("limit"), 20, 1, 100);
  const offset = parseIntParam(params.get("offset"), 0, 0, 100_000);
  const status = parseStringParam(params.get("status"), ["PENDING", "COMPLETED", "FAILED"]);
  const validator = params.get("validator") || undefined;

  // PostgREST table endpoint for data (supports native filters)
  const filters: string[] = [];
  if (validator) filters.push(`target_validator=eq.${encodeURIComponent(validator)}`);
  if (status) filters.push(`status=eq.${status}`);
  const filterStr = filters.length > 0 ? `&${filters.join("&")}` : "";
  const jobsPath = `/compute_jobs?limit=${limit + 1}&offset=${offset}&order=created_at.desc${filterStr}`;

  // RPC endpoint for filtered total count (_limit=0 returns pagination.total)
  const rpcFilters: string[] = ["_limit=0", "_offset=0"];
  if (status) rpcFilters.push(`_status=${status}`);
  if (validator) rpcFilters.push(`_validator=${encodeURIComponent(validator)}`);
  const countPath = `/rpc/get_compute_jobs?${rpcFilters.join("&")}`;

  // Fetch jobs, count, and moniker map in parallel
  const [jobsResult, countResult, monikerResult] = await Promise.all([
    fetchYaci<ComputeJob[]>(jobsPath),
    fetchYaci<RpcCountResponse>(countPath),
    fetchYaci<MonikerEntry[]>("/compute_leaderboard?select=target_validator,moniker"),
  ]);

  if (!jobsResult.ok) {
    return jsonResponse(
      { error: "Compute jobs temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const hasNext = jobsResult.data.length > limit;
  const jobs = hasNext ? jobsResult.data.slice(0, limit) : jobsResult.data;
  const total = countResult.ok ? countResult.data.pagination.total : null;

  // Build moniker lookup — gracefully empty if leaderboard call failed
  const monikers: Record<string, string> = {};
  if (monikerResult.ok) {
    for (const entry of monikerResult.data) {
      if (entry.moniker) monikers[entry.target_validator] = entry.moniker;
    }
  }

  return jsonResponse({ jobs, hasNext, total, monikers, limit, offset }, rl.headers, 200, {
    sMaxAge: 10,
    staleWhileRevalidate: 30,
  });
}
