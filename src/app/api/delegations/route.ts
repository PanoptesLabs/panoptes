import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const validatorId = url.searchParams.get("validatorId");
  const search = url.searchParams.get("search")?.trim();
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 20), 100);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const conditions: Record<string, unknown>[] = [];
  if (type) conditions.push({ type });
  if (validatorId) {
    conditions.push({ OR: [{ validatorTo: validatorId }, { validatorFrom: validatorId }] });
  }
  if (search) {
    conditions.push({
      OR: [
        { delegator: { contains: search, mode: "insensitive" } },
        { validatorTo: { contains: search, mode: "insensitive" } },
        { validatorFrom: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [events, total] = await Promise.all([
    prisma.delegationEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.delegationEvent.count({ where }),
  ]);

  return jsonResponse({ events, total, limit, offset }, rl.headers);
}
