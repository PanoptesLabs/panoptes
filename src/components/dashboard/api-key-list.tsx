"use client";

import { useState } from "react";
import { useApiKeys } from "@/hooks/use-api-keys";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";
import { Key, Plus, X, Loader2, Copy, CheckCircle, Trash2 } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { AuthGate } from "./auth-gate";

const TIER_OPTIONS = ["free", "pro"] as const;

export function ApiKeyList() {
  const { data, error, isLoading, mutate } = useApiKeys();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTier, setFormTier] = useState<string>("free");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!formName.trim()) {
      setNameError("Name is required");
      return;
    }
    if (formName.trim().length > 100) {
      setNameError("Name must be at most 100 characters");
      return;
    }
    setNameError(null);
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: formName.trim(), tier: formTier }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create API key");
      }
      const result = await res.json();
      if (result.key) setCreatedKey(result.key);
      setFormName("");
      setFormTier("free");
      setShowForm(false);
      await mutate();
      toast.success("API key created");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create API key");
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Failed to deactivate API key");
        return;
      }
      await mutate();
      toast.success("API key deactivated");
    } catch {
      toast.error("Network error");
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error && !data) {
    return <ErrorState message="Failed to load API keys" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      {createdKey && (
        <Card className="border-teal-DEFAULT/30 bg-teal-dark/10">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-light">API Key Created</p>
                <p className="mt-1 text-xs text-teal-light/60">
                  Copy this key now — it won&apos;t be shown again.
                </p>
                <code className="mt-2 block break-all rounded bg-slate-dark/50 px-3 py-2 font-mono text-xs text-mist">
                  {createdKey}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyKey}
                  className="text-teal-light hover:bg-teal-dark/30"
                >
                  {copied ? <CheckCircle className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatedKey(null)}
                  className="text-teal-light/50 hover:bg-teal-dark/30"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm ? (
        <AuthGate requiredRole="admin" onAction={() => setShowForm(true)}>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
          >
            <Plus className="size-3.5" />
            Create API Key
          </Button>
        </AuthGate>
      ) : (
        <Card className="border-soft-violet/30 bg-midnight-plum">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-mist">New API Key</CardTitle>
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
              <label htmlFor="api-key-name" className="mb-1 block text-xs text-dusty-lavender/50">Name</label>
              <input
                id="api-key-name"
                type="text"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setNameError(null); }}
                placeholder="My API Key"
                maxLength={100}
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
              <label className="mb-1 flex items-center gap-1 text-xs text-dusty-lavender/50">
                Tier
                <HelpTooltip
                  content={formTier === "pro" ? helpContent.apiKeys.pro : helpContent.apiKeys.free}
                  side="right"
                />
              </label>
              <div className="flex gap-2">
                {TIER_OPTIONS.map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setFormTier(tier)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize",
                      formTier === tier
                        ? "border-soft-violet/50 bg-soft-violet/15 text-soft-violet"
                        : "border-slate-DEFAULT/20 text-dusty-lavender/50 hover:border-slate-DEFAULT/40",
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            {createError && (
              <p className="text-xs text-rose-DEFAULT">{createError}</p>
            )}
            <Button
              onClick={handleCreate}
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
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
        </div>
      )}

      {data && data.keys.length === 0 && (
        <EmptyState
          icon={<Key className="size-5 text-dusty-lavender/40" />}
          title="No API keys created"
          description="Create an API key to access Panoptes data programmatically."
          action={{ label: "Create API Key", onClick: () => setShowForm(true) }}
        />
      )}

      {data && data.keys.length > 0 && (
        <div className="space-y-3">
          {data.keys.map((apiKey) => (
            <Card key={apiKey.id} className="border-slate-DEFAULT/20 bg-midnight-plum">
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-mist">{apiKey.name}</p>
                    <span className="rounded-full border border-slate-DEFAULT/20 px-2 py-0.5 text-[10px] capitalize text-dusty-lavender/50">
                      {apiKey.tier}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-dusty-lavender/50">
                    {apiKey.keyPrefix}...
                  </p>
                  <p className="mt-1 text-[10px] text-dusty-lavender/30">
                    {apiKey.lastUsedAt ? `Last used ${timeAgo(apiKey.lastUsedAt)}` : "Never used"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      apiKey.isActive
                        ? "border-teal-DEFAULT/30 bg-teal-dark/50 text-teal-light"
                        : "border-slate-DEFAULT/30 bg-slate-dark/50 text-slate-light",
                    )}
                  >
                    {apiKey.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-[10px] text-dusty-lavender/40">
                    {timeAgo(apiKey.createdAt)}
                  </span>
                  {apiKey.isActive && (
                    <AuthGate requiredRole="admin" onAction={() => handleDeactivate(apiKey.id)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-DEFAULT/50 hover:bg-rose-DEFAULT/10 hover:text-rose-DEFAULT"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AuthGate>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
