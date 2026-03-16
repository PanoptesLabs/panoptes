import { describe, it, expect } from "vitest";
import { IndexerError, ApiError, CronAuthError } from "@/lib/errors";

describe("IndexerError", () => {
  it("stores message and source", () => {
    const err = new IndexerError("timeout", "validators");
    expect(err.message).toBe("timeout");
    expect(err.source).toBe("validators");
    expect(err.name).toBe("IndexerError");
  });

  it("is instance of Error", () => {
    const err = new IndexerError("fail", "endpoints");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IndexerError);
  });
});

describe("ApiError", () => {
  it("stores message and statusCode", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("ApiError");
  });

  it("is instance of Error", () => {
    const err = new ApiError("Bad", 400);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("CronAuthError", () => {
  it("uses default message when none provided", () => {
    const err = new CronAuthError();
    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("CronAuthError");
  });

  it("accepts custom message", () => {
    const err = new CronAuthError("Invalid token");
    expect(err.message).toBe("Invalid token");
  });
});
