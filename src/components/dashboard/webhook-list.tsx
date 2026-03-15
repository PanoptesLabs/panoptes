"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWebhooks, createWebhook } from "@/hooks/use-webhooks";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { Webhook, Plus, X, Loader2, Copy, CheckCircle } from "lucide-react";

const EVENT_OPTIONS = [
  "anomaly.created",
  "anomaly.resolved",
  "incident.created",
  "incident.acknowledged",
  "incident.resolved",
  "slo.breached",
  "slo.recovered",
  "slo.budget_exhausted",
];

export function WebhookList() {
  const { token } = useWorkspace();
  const { data, error, isLoading, mutate } = useWebhooks(token);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleCreate = async () => {
    if (!token || !formName.trim() || !formUrl.trim() || formEvents.length === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createWebhook(token, {
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents,
      });
      if (result.secret) {
        setCreatedSecret(result.secret);
      }
      setFormName("");
      setFormUrl("");
      setFormEvents([]);
      setShowForm(false);
      await mutate();
    } catch {
      setCreateError("Failed to create webhook. Check the URL and try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error && !data) {
    return <ErrorState message="Failed to load webhooks" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      {/* Secret display */}
      {createdSecret && (
        <Card className="border-teal-DEFAULT/30 bg-teal-dark/10">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-light">Webhook Secret</p>
                <p className="mt-1 text-xs text-teal-light/60">
                  Copy this secret now — it won&apos;t be shown again.
                </p>
                <code className="mt-2 block break-all rounded bg-slate-dark/50 px-3 py-2 font-mono text-xs text-mist">
                  {createdSecret}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySecret}
                  className="text-teal-light hover:bg-teal-dark/30"
                >
                  {copied ? <CheckCircle className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatedSecret(null)}
                  className="text-teal-light/50 hover:bg-teal-dark/30"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create button / form */}
      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
        >
          <Plus className="size-3.5" />
          Create Webhook
        </Button>
      ) : (
        <Card className="border-soft-violet/30 bg-midnight-plum">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-mist">New Webhook</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="text-dusty-lavender/50 hover:text-mist"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-dusty-lavender/50">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Webhook"
                maxLength={100}
                className="h-9 w-full rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50 focus:ring-1 focus:ring-soft-violet/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dusty-lavender/50">URL</label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                maxLength={2048}
                className="h-9 w-full rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50 focus:ring-1 focus:ring-soft-violet/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dusty-lavender/50">Events</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      formEvents.includes(event)
                        ? "border-soft-violet/50 bg-soft-violet/15 text-soft-violet"
                        : "border-slate-DEFAULT/20 text-dusty-lavender/50 hover:border-slate-DEFAULT/40",
                    )}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            {createError && (
              <p className="text-xs text-rose-DEFAULT">{createError}</p>
            )}
            <Button
              onClick={handleCreate}
              disabled={creating || !formName.trim() || !formUrl.trim() || formEvents.length === 0}
              className="bg-soft-violet text-white hover:bg-soft-violet/80 disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
        </div>
      )}

      {/* Empty state */}
      {data && data.webhooks.length === 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Webhook className="size-8 text-dusty-lavender/30" />
            <p className="text-sm text-dusty-lavender/50">No webhooks configured</p>
          </CardContent>
        </Card>
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
                    <span className="text-[10px] text-dusty-lavender/40">
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
