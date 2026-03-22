import { NextRequest } from "next/server";
import { dispatchWebhooks } from "@/lib/webhooks/dispatch";
import { runSingleCron } from "@/lib/cron-helpers";

export async function POST(request: NextRequest) {
  return runSingleCron(request, "Webhooks", dispatchWebhooks);
}
