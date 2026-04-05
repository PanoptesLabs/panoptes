import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseStringParam } from "@/lib/validation";
import { fetchYaci } from "@/lib/yaci";
import type { ComputeJob } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;
  const limit = parseIntParam(params.get("limit"), 20, 1, 100);
  const offset = parseIntParam(params.get("offset"), 0, 0, 100_000);
  const status = parseStringParam(params.get("status"), ["PENDING", "COMPLETED", "FAILED"]);
  const validator = params.get("validator") || undefined;

  // Use PostgREST table endpoint — supports filters natively.
  // Fetch limit+1 to determine hasNext without a separate count query.
  const filters: string[] = [];
  if (validator) filters.push(`target_validator=eq.${encodeURIComponent(validator)}`);
  if (status) filters.push(`status=eq.${status}`);

  const filterStr = filters.length > 0 ? `&${filters.join("&")}` : "";
  const path = `/compute_jobs?limit=${limit + 1}&offset=${offset}&order=created_at.desc${filterStr}`;

  const result = await fetchYaci<ComputeJob[]>(path);

  if (!result.ok) {
    return jsonResponse(
      { error: "Compute jobs temporarily unavailable" },
      rl.headers,
      502,
      { cache: false },
    );
  }

  const hasNext = result.data.length > limit;
  const jobs = hasNext ? result.data.slice(0, limit) : result.data;

  return jsonResponse({ jobs, hasNext, limit, offset }, rl.headers, 200, {
    sMaxAge: 10,
    staleWhileRevalidate: 30,
  });
}
