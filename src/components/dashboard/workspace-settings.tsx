"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useAuthContext } from "@/components/dashboard/auth-provider";
import { sessionSwrConfig } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "./error-state";
import { timeAgo } from "@/lib/time";
import {
  Building,
  Target,
  Webhook,
  Siren,
  Loader2,
  Pencil,
  Wallet,
} from "lucide-react";

interface WorkspaceMeResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
  resources: {
    slos: number;
    webhooks: number;
    incidents: number;
  };
}

export function WorkspaceSettings() {
  const { isAuthenticated, role, setShowConnectModal } = useAuthContext();
  const isAdmin = role === "admin";
  const { data, error, isLoading, mutate } = useSWR<WorkspaceMeResponse>(
    isAuthenticated && isAdmin ? "/api/workspaces/me" : null,
    sessionSwrConfig,
  );

  // Editable name
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-md border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-soft-violet/15">
              <Wallet className="size-6 text-soft-violet" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-mist">Connect Wallet</h3>
              <p className="mt-1 text-sm text-dusty-lavender/50">
                Connect your wallet to manage workspace settings
              </p>
            </div>
            <Button
              onClick={() => setShowConnectModal(true)}
              className="bg-soft-violet text-white hover:bg-soft-violet/80"
            >
              <Wallet className="size-4" />
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="w-full max-w-md border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-DEFAULT/15">
              <Building className="size-6 text-amber-DEFAULT" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-mist">Admin Access Required</h3>
              <p className="mt-1 text-sm text-dusty-lavender/50">
                Workspace settings are only accessible to admin users
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setNameError("Name is required");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    setNameError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        mutate();
        setIsEditing(false);
        toast.success("Workspace updated");
      } else {
        setNameError("Failed to update name");
        toast.error("Failed to update workspace");
      }
    } catch {
      setNameError("Network error");
      toast.error("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return <ErrorState message="Failed to load workspace" onRetry={() => mutate()} />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const { workspace, resources } = data;

  return (
    <div className="space-y-6">
      {/* Workspace Info */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-mist">
            <Building className="size-4 text-soft-violet" />
            Workspace Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Name</p>
              {isEditing ? (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setNameError(null);
                      }}
                      className="h-8 rounded border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-sm text-mist outline-none focus:border-soft-violet/50"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={isSaving}>
                      {isSaving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setNameError(null); }}>
                      Cancel
                    </Button>
                  </div>
                  {nameError && (
                    <p className="text-xs text-rose-DEFAULT">{nameError}</p>
                  )}
                </div>
              ) : (
                <p
                  className="group mt-1 flex cursor-pointer items-center gap-1.5 text-sm text-mist hover:text-soft-violet"
                  title="Click to edit"
                  onClick={() => {
                    setEditName(workspace.name);
                    setIsEditing(true);
                  }}
                >
                  {workspace.name}
                  <Pencil className="size-3 text-dusty-lavender/30 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Slug</p>
              <p className="mt-1 font-mono text-sm text-mist">{workspace.slug}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Created</p>
              <p className="mt-1 text-sm text-mist">{timeAgo(workspace.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-dusty-lavender/50">Last Updated</p>
              <p className="mt-1 text-sm text-mist">{timeAgo(workspace.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-DEFAULT/15">
              <Target className="size-5 text-teal-DEFAULT" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.slos}</p>
              <p className="text-xs text-dusty-lavender/50">SLOs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-soft-violet/15">
              <Webhook className="size-5 text-soft-violet" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.webhooks}</p>
              <p className="text-xs text-dusty-lavender/50">Webhooks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-DEFAULT/15">
              <Siren className="size-5 text-amber-DEFAULT" />
            </div>
            <div>
              <p className="text-2xl font-bold text-mist">{resources.incidents}</p>
              <p className="text-xs text-dusty-lavender/50">Incidents</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
