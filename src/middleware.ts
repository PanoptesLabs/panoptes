import { NextResponse, type NextRequest } from "next/server";

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const landingHost = safeHost(process.env.NEXT_PUBLIC_APP_URL);
const dashboardHost = safeHost(process.env.NEXT_PUBLIC_DASHBOARD_URL);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Skip in dev
  if (!landingHost || !dashboardHost || host === "localhost:3000") {
    return NextResponse.next();
  }

  // *.vercel.app → redirect to panoptes.cc (SEO canonical)
  if (host.endsWith(".vercel.app")) {
    const url = request.nextUrl.clone();
    url.host = pathname.startsWith("/dashboard") ? dashboardHost : landingHost;
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // panoptes.cc + /dashboard → redirect to app.panoptes.cc
  if (host === landingHost && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.host = dashboardHost;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // app.panoptes.cc + root → redirect to /dashboard
  if (host === dashboardHost && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.svg|logo\\.svg|apple-icon).*)"],
};
