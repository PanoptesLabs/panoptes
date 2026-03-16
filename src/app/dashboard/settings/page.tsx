"use client";

import Link from "next/link";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building,
  Settings,
  ScrollText,
  Key,
} from "lucide-react";

const settingsCards = [
  {
    href: "/dashboard/settings/workspace",
    icon: Building,
    title: "Workspace",
    description: "Manage workspace details, view resources, and rotate API token",
    color: "text-soft-violet",
    bg: "bg-soft-violet/15",
  },
  {
    href: "/dashboard/settings/webhooks",
    icon: Settings,
    title: "Webhooks",
    description: "Configure webhook endpoints for real-time event notifications",
    color: "text-teal-DEFAULT",
    bg: "bg-teal-DEFAULT/15",
    requiresAuth: true,
  },
  {
    href: "/dashboard/settings/policies",
    icon: ScrollText,
    title: "Policies",
    description: "Define alerting policies and escalation rules for incidents",
    color: "text-amber-DEFAULT",
    bg: "bg-amber-DEFAULT/15",
    requiresAuth: true,
  },
  {
    href: "/dashboard/settings/api-keys",
    icon: Key,
    title: "API Keys",
    description: "Create and manage API keys for external integrations",
    color: "text-rose-DEFAULT",
    bg: "bg-rose-DEFAULT/15",
    requiresAuth: true,
  },
];

export default function SettingsPage() {
  const { isAuthenticated } = useWorkspace();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your workspace, integrations, and access controls"
        breadcrumbs={[{ label: "Settings" }]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {settingsCards.map((card) => {
          const locked = card.requiresAuth && !isAuthenticated;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="group border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-slate-DEFAULT/40">
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                    <card.icon className={`size-5 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-mist group-hover:text-soft-violet transition-colors">
                        {card.title}
                      </h3>
                      {locked && (
                        <span className="rounded bg-amber-DEFAULT/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-DEFAULT">
                          Token required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-dusty-lavender/50">
                      {card.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
