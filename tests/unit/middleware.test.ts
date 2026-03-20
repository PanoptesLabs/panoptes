import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Use vi.hoisted to set env BEFORE middleware module is loaded
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://panoptes.cc";
  process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://app.panoptes.cc";
});

import { middleware } from "@/middleware";

function createRequest(url: string, host: string): NextRequest {
  const req = new NextRequest(new URL(url, `https://${host}`), {
    headers: { host },
  });
  return req;
}

describe("middleware", () => {
  it("passes through in dev (localhost)", () => {
    const req = createRequest("/", "localhost:3000");
    const res = middleware(req);
    expect(res.status).not.toBe(301);
    expect(res.status).not.toBe(308);
  });

  it("redirects vercel.app to panoptes.cc (301)", () => {
    const req = createRequest("/", "panoptes-mauve.vercel.app");
    const res = middleware(req);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("panoptes.cc");
  });

  it("redirects vercel.app/dashboard to app.panoptes.cc (301)", () => {
    const req = createRequest("/dashboard", "panoptes-mauve.vercel.app");
    const res = middleware(req);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("app.panoptes.cc");
  });

  it("redirects panoptes.cc/dashboard to app.panoptes.cc (308)", () => {
    const req = createRequest("/dashboard", "panoptes.cc");
    const res = middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("app.panoptes.cc");
  });

  it("redirects app.panoptes.cc/ to /dashboard (308)", () => {
    const req = createRequest("/", "app.panoptes.cc");
    const res = middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("passes through panoptes.cc/ (landing page)", () => {
    const req = createRequest("/", "panoptes.cc");
    const res = middleware(req);
    expect(res.status).not.toBe(301);
    expect(res.status).not.toBe(308);
  });

  it("passes through app.panoptes.cc/dashboard", () => {
    const req = createRequest("/dashboard", "app.panoptes.cc");
    const res = middleware(req);
    expect(res.status).not.toBe(301);
    expect(res.status).not.toBe(308);
  });

  it("passes through app.panoptes.cc/dashboard/validators", () => {
    const req = createRequest("/dashboard/validators", "app.panoptes.cc");
    const res = middleware(req);
    expect(res.status).not.toBe(301);
    expect(res.status).not.toBe(308);
  });

  it("redirects panoptes.cc/dashboard/settings to app.panoptes.cc", () => {
    const req = createRequest("/dashboard/settings", "panoptes.cc");
    const res = middleware(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("app.panoptes.cc");
    expect(res.headers.get("location")).toContain("/dashboard/settings");
  });

  it("preserves path on vercel.app redirect", () => {
    const req = createRequest("/about", "panoptes-mauve.vercel.app");
    const res = middleware(req);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toContain("/about");
  });

  it("passes through non-matching hosts", () => {
    const req = createRequest("/", "www.panoptes.cc");
    const res = middleware(req);
    expect(res.status).not.toBe(301);
  });
});
