"use client";

import { useState } from "react";
import { createWebhook } from "@/hooks/use-webhooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { WEBHOOK_EVENTS } from "@/lib/constants";

interface WebhookFormProps {
  onClose: () => void;
  onCreated: (secret: string | null) => void;
}

export function WebhookForm({ onClose, onCreated }: WebhookFormProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
    setEventsError(null);
  };

  const validateForm = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError("Name is required");
      valid = false;
    } else if (name.trim().length > 100) {
      setNameError("Name must be at most 100 characters");
      valid = false;
    } else {
      setNameError(null);
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setUrlError("URL is required");
      valid = false;
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== "https:") {
          setUrlError("URL must use HTTPS");
          valid = false;
        } else {
          setUrlError(null);
        }
      } catch {
        setUrlError("Invalid URL format");
        valid = false;
      }
    }

    if (events.length === 0) {
      setEventsError("Select at least one event");
      valid = false;
    } else {
      setEventsError(null);
    }

    return valid;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createWebhook({
        name: name.trim(),
        url: url.trim(),
        events,
      });
      onCreated(result.secret ?? null);
      toast.success("Webhook created");
    } catch {
      setCreateError("Failed to create webhook. Check the URL and try again.");
      toast.error("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-soft-violet/30 bg-midnight-plum">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-mist">New Webhook</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-dusty-lavender/50 hover:text-mist"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
        <div>
          <label htmlFor="webhook-name" className="mb-1 block text-xs text-dusty-lavender/50">Name</label>
          <input
            id="webhook-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null); }}
            placeholder="My Webhook"
            maxLength={100}
            autoFocus
            className={cn(
              "h-9 w-full rounded-lg border bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:ring-1",
              nameError
                ? "border-rose-DEFAULT/50 focus:border-rose-DEFAULT focus:ring-rose-DEFAULT/20"
                : "border-slate-DEFAULT/20 focus:border-soft-violet/50 focus:ring-soft-violet/20"
            )}
          />
          {nameError && <p className="mt-1 text-xs text-rose-DEFAULT">{nameError}</p>}
        </div>
        <div>
          <label htmlFor="webhook-url" className="mb-1 flex items-center gap-1 text-xs text-dusty-lavender/50">
            URL
            <HelpTooltip content={helpContent.webhooks.concepts.httpsRequired} side="right" />
          </label>
          <input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
            placeholder="https://example.com/webhook"
            maxLength={2048}
            className={cn(
              "h-9 w-full rounded-lg border bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:ring-1",
              urlError
                ? "border-rose-DEFAULT/50 focus:border-rose-DEFAULT focus:ring-rose-DEFAULT/20"
                : "border-slate-DEFAULT/20 focus:border-soft-violet/50 focus:ring-soft-violet/20"
            )}
          />
          {urlError && <p className="mt-1 text-xs text-rose-DEFAULT">{urlError}</p>}
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-dusty-lavender/50">
            Events
            <HelpTooltip content={helpContent.webhooks.concepts.eventSelection} side="right" />
          </label>
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENTS.map((event) => (
              <button
                type="button"
                key={event}
                onClick={() => toggleEvent(event)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  events.includes(event)
                    ? "border-soft-violet/50 bg-soft-violet/15 text-soft-violet"
                    : "border-slate-DEFAULT/20 text-dusty-lavender/50 hover:border-slate-DEFAULT/40",
                )}
              >
                {event}
              </button>
            ))}
          </div>
          {eventsError && <p className="mt-1 text-xs text-rose-DEFAULT">{eventsError}</p>}
        </div>
        {createError && (
          <p className="text-xs text-rose-DEFAULT">{createError}</p>
        )}
        <Button
          type="submit"
          disabled={creating}
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
        </form>
      </CardContent>
    </Card>
  );
}
