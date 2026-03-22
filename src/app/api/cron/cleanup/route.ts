import { NextRequest } from "next/server";
import { cleanupOldData } from "@/lib/indexer";
import { runSingleCron } from "@/lib/cron-helpers";

export async function POST(request: NextRequest) {
  return runSingleCron(request, "Cleanup", cleanupOldData);
}
