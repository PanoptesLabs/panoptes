"use client";

import { useState } from "react";
import Link from "next/link";
import { useWebhooks } from "@/hooks/use-webhooks";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { Webhook, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { AuthGate } from "./auth-gate";
import { SecretBanner } from "./secret-banner";
import { WebhookForm } from "./webhook-form";

export function WebhookList() {
  const { data, error, isLoading, mutate } = useWebhooks();
  const [showForm, setShowForm] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const handleCreated = async (secret: string | null) => {
    if (secret) setCreatedSecret(secret);
    setShowForm(false);
    await mutate();
  };

  if (error && !data) {
    return <ErrorState message="Failed to load webhooks" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      {/* Secret display */}
      {createdSecret && (
        <SecretBanner
          title="Webhook Secret"
          value={createdSecret}
          helpContent={<HelpTooltip content={helpContent.webhooks.concepts.secret} side="right" />}
          onDismiss={() => setCreatedSecret(null)}
        />
      )}

      {/* Create button / form */}
      {!showForm ? (
        <AuthGate requiredRole="editor" onAction={() => setShowForm(true)}>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
          >
            <Plus className="size-3.5" />
            Create Webhook
          </Button>
        </AuthGate>
      ) : (
        <WebhookForm onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}

      {/* Loading */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* Empty state */}
      {data && data.webhooks.length === 0 && (
        <EmptyState
          icon={<Webhook className="size-5 text-dusty-lavender/60" />}
          title="No webhooks configured"
          description="Create a webhook to receive real-time notifications for events."
        />
      )}

      {/* Webhook list */}
      {data && data.webhooks.length > 0 && (
        <div className="space-y-3">
          {data.webhooks.map((webhook) => (
            <Link key={webhook.id} href={`/dashboard/settings/webhooks/${webhook.id}`}>
              <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mist">{webhook.name}</p>
                    <p className="mt-1 truncate text-xs text-dusty-lavender/50">{webhook.url}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="rounded-full border border-slate-DEFAULT/20 px-2 py-0.5 text-[10px] text-dusty-lavender/50"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        webhook.isActive
                          ? "border-teal-DEFAULT/30 bg-teal-dark/50 text-teal-light"
                          : "border-slate-DEFAULT/30 bg-slate-dark/50 text-slate-light",
                      )}
                    >
                      {webhook.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] text-dusty-lavender/60">
                      {timeAgo(webhook.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
