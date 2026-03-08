import { describe, it, expect } from "vitest";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

describe("Panoptes", () => {
  it("should have correct app name", () => {
    expect(APP_NAME).toBe("Panoptes");
  });

  it("should have a version", () => {
    expect(APP_VERSION).toBeDefined();
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
