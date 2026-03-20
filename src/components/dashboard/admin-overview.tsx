"use client";

import Link from "next/link";
import { useAdminOverview } from "@/hooks/use-admin";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/time";
import {
  Users,
  Monitor,
  AlertTriangle,
  Activity,
  Shield,
  Key,
  Target,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "member.role_changed": "Changed role",
  "session.revoked": "Revoked session",
  "api_key.disabled": "Disabled API key",
  "webhook.disabled": "Disabled webhook",
  "policy.disabled": "Disabled policy",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", color)}>
          <Icon className="size-5 text-inherit" />
        </div>
        <div>
          <p className="text-2xl font-bold text-mist">{value}</p>
          <p className="text-xs text-dusty-lavender/50">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full bg-deep-iris/20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardContent className="pt-6">
              <Skeleton className="h-24 w-full bg-deep-iris/20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminOverview() {
  const { data, error, isLoading, mutate } = useAdminOverview();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message="Failed to load admin overview" onRetry={() => mutate()} />;
  if (!data) return null;

  const totalDeliveries = data.deliveries24h.success + data.deliveries24h.failed;
  const healthLabel = totalDeliveries > 0
    ? `${Math.round((data.deliveries24h.success / totalDeliveries) * 100)}%`
    : "—";

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={data.users.total} icon={Users} color="bg-soft-violet/15 text-soft-violet" />
        <StatCard label="Active Sessions" value={data.sessions.active} icon={Monitor} color="bg-teal-DEFAULT/15 text-teal-DEFAULT" />
        <StatCard label="Open Incidents" value={data.resources.incidents} icon={AlertTriangle} color="bg-rose-DEFAULT/15 text-rose-DEFAULT" />
        <StatCard label="Webhook Health (24h)" value={healthLabel} icon={Activity} color="bg-amber-DEFAULT/15 text-amber-DEFAULT" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Members by Role */}
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
              <Shield className="size-4 text-soft-violet" />
              Members by Role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["admin", "editor", "member", "viewer"].map((role) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-xs capitalize text-dusty-lavender/70">{role}</span>
                <span className="text-sm font-medium text-mist">{data.members[role] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Resource Counts */}
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
              <Target className="size-4 text-teal-DEFAULT" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Webhooks", value: data.resources.webhooks, icon: Settings },
              { label: "SLOs", value: data.resources.slos, icon: Target },
              { label: "Policies", value: data.resources.policies, icon: ScrollText },
              { label: "API Keys", value: data.resources.apiKeys, icon: Key },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-dusty-lavender/70">
                  <item.icon className="size-3 text-dusty-lavender/40" />
                  {item.label}
                </span>
                <span className="text-sm font-medium text-mist">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Audit Log */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-mist">Recent Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAudit.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No audit entries yet</p>
          ) : (
            <div className="space-y-2">
              {data.recentAudit.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg bg-deep-iris/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-mist">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="text-[10px] text-dusty-lavender/50">
                      <span className="font-mono">{entry.actorAddress.slice(0, 10)}...{entry.actorAddress.slice(-4)}</span>
                      {entry.resourceType && (
                        <span> &middot; {entry.resourceType}</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-dusty-lavender/40">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/admin/access">
          <Card className="group border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-slate-DEFAULT/40">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-DEFAULT/15">
                <Users className="size-5 text-teal-DEFAULT" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-mist group-hover:text-soft-violet transition-colors">
                  Access Management
                </h3>
                <p className="mt-1 text-xs text-dusty-lavender/50">
                  Manage users, sessions, and API keys
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/admin/operations">
          <Card className="group border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-slate-DEFAULT/40">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-DEFAULT/15">
                <Activity className="size-5 text-amber-DEFAULT" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-mist group-hover:text-soft-violet transition-colors">
                  Operations
                </h3>
                <p className="mt-1 text-xs text-dusty-lavender/50">
                  Webhooks, policies, and incidents
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
