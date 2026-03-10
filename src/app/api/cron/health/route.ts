import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { checkEndpoints } from "@/lib/indexer";

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {
    const result = await checkEndpoints();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron Health]", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
