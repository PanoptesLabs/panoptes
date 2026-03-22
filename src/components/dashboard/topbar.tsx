"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Wallet, LogOut } from "lucide-react";
import { useAuthContext } from "@/components/dashboard/auth-provider";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  validators: "Validators",
  endpoints: "Endpoints",
  anomalies: "Anomalies",
  network: "Network",
  slos: "SLOs",
  incidents: "Incidents",
  governance: "Governance",
  delegations: "Delegations",
  forecasts: "Forecasts",
  settings: "Settings",
  webhooks: "Webhooks",
  policies: "Policies",
  "api-keys": "API Keys",
  leaderboard: "Leaderboard",
  admin: "Admin",
  access: "Access",
  operations: "Operations",
};

function formatSegment(segment: string): string {
  return ROUTE_LABELS[segment] ?? (segment.length >= 12 ? `${segment.slice(0, 8)}...${segment.slice(-4)}` : segment);
}

export function Topbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, setShowConnectModal } = useAuthContext();

  const segments = pathname.split("/").filter(Boolean);
  // segments: ["dashboard", "validators", "abc123..."]

  const crumbs = segments.map((seg, i) => ({
    label: formatSegment(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <div className="hidden lg:sticky lg:top-0 lg:z-30 lg:flex h-14 items-center justify-between border-b border-slate-DEFAULT/20 bg-slate-dark/95 px-6 backdrop-blur-sm">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-dusty-lavender/50">
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {crumb.href !== "/" + segments[0] && (
              <ChevronRight className="size-3.5 text-dusty-lavender/50" />
            )}
            {crumb.isLast ? (
              <span className="text-mist font-medium" aria-current="page">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-soft-violet"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-teal-DEFAULT">
              <Wallet className="size-3.5" />
              <span className="font-mono" title={user.address}>
                {user.address.slice(0, 8)}...{user.address.slice(-4)}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-dusty-lavender/50 transition-colors hover:bg-deep-iris/20 hover:text-dusty-lavender/70"
              title="Disconnect wallet"
              aria-label="Sign out"
            >
              <LogOut className="size-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-soft-violet transition-colors hover:bg-soft-violet/10"
          >
            <Wallet className="size-3.5" />
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}
