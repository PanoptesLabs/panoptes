import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseStringParam } from "@/lib/validation";
import { fetchYaci } from "@/lib/yaci";
import type { ComputeJobsResponse } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;
  const limit = parseIntParam(params.get("limit"), 20, 1, 100);
  const offset = parseIntParam(params.get("offset"), 0, 0, 100_000);
  const status = parseStringParam(params.get("status"), ["PENDING", "COMPLETED", "FAILED"]);
  const validator = params.get("validator") || undefined;

  const filters: string[] = [];
  if (validator) filters.push(`target_validator=eq.${encodeURIComponent(validator)}`);
  if (status) filters.push(`status=eq.${status}`);

  const filterStr = filters.length > 0 ? `&${filters.join("&")}` : "";
  // /rpc/get_compute_jobs returns { data: [...], pagination: {...} }
  const path = `/rpc/get_compute_jobs?_limit=${limit}&_offset=${offset}${filterStr}`;

  const result = await fetchYaci<ComputeJobsResponse>(path);

  if (!result.ok) {
    return jsonResponse(
      { error: "Compute jobs temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const jobs = result.data.data ?? [];
  const total = result.data.pagination?.total ?? jobs.length;

  return jsonResponse({ jobs, total, limit, offset }, rl.headers, 200, {
    sMaxAge: 10,
    staleWhileRevalidate: 30,
  });
}
