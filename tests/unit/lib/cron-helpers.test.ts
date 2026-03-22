import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cron-auth", () => ({
  validateCronAuth: vi.fn(),
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import { runStep, runSingleCron, type StepError } from "@/lib/cron-helpers";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

function makeCronRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/test", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("cron-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCronAuth).mockReturnValue(null);
    vi.mocked(withRateLimit).mockReturnValue({
      headers: { "X-RateLimit-Limit": "60" },
    });
  });

  describe("runStep", () => {
    it("returns result on success", async () => {
      const errors: StepError[] = [];
      const result = await runStep("test", async () => ({ count: 5 }), errors);
      expect(result).toEqual({ count: 5 });
      expect(errors).toHaveLength(0);
    });

    it("returns null and pushes error on failure", async () => {
      const errors: StepError[] = [];
      const result = await runStep(
        "failing",
        async () => { throw new Error("DB timeout"); },
        errors,
      );
      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({ step: "failing", error: "DB timeout" });
    });

    it("logs with custom prefix", async () => {
      const errors: StepError[] = [];
      await runStep(
        "myStep",
        async () => { throw new Error("fail"); },
        errors,
        "Custom Prefix",
      );
      expect(logger.error).toHaveBeenCalledWith("Custom Prefix: myStep", "fail");
    });

    it("handles non-Error thrown values", async () => {
      const errors: StepError[] = [];
      await runStep(
        "badThrow",
        async () => { throw "string error"; },
        errors,
      );
      expect(errors[0].error).toBe("string error");
    });
  });

  describe("runSingleCron", () => {
    it("returns 401 when auth fails", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(validateCronAuth).mockReturnValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const res = await runSingleCron(makeCronRequest(), "Test", async () => ({}));
      expect(res.status).toBe(401);
    });

    it("returns 429 when rate limited", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(withRateLimit).mockReturnValue({
        response: NextResponse.json({ error: "Too many requests" }, { status: 429 }),
      });

      const res = await runSingleCron(makeCronRequest(), "Test", async () => ({}));
      expect(res.status).toBe(429);
    });

    it("returns success with result data", async () => {
      const res = await runSingleCron(
        makeCronRequest(),
        "Test",
        async () => ({ checked: 3, healthy: 2 }),
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.checked).toBe(3);
    });

    it("returns 500 on error", async () => {
      const res = await runSingleCron(
        makeCronRequest(),
        "Test",
        async () => { throw new Error("DB timeout"); },
      );
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });

    it("hides error details in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      try {
        const res = await runSingleCron(
          makeCronRequest(),
          "Test",
          async () => { throw new Error("secret details"); },
        );
        const body = await res.json();
        expect(body.error).toBe("Internal server error");
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
