import { NextRequest } from "next/server";
import { generateForecasts } from "@/lib/intelligence";
import { runSingleCron } from "@/lib/cron-helpers";

export async function POST(request: NextRequest) {
  return runSingleCron(request, "Forecasts", generateForecasts);
}
