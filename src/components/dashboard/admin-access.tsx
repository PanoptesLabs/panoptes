"use client";

import { useState } from "react";
import {
  useAdminAccess,
  changeUserRole,
  revokeSession,
  disableApiKey,
} from "@/hooks/use-admin";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Users, Key, Ban, XCircle } from "lucide-react";

const ROLES = ["viewer", "member", "editor", "admin"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-DEFAULT/15 text-rose-DEFAULT",
  editor: "bg-amber-DEFAULT/15 text-amber-DEFAULT",
  member: "bg-teal-DEFAULT/15 text-teal-DEFAULT",
  viewer: "bg-dusty-lavender/15 text-dusty-lavender/70",
};

interface PendingAction {
  type: "role" | "revoke" | "disable-key";
  id: string;
  label: string;
  meta?: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="pt-6">
            <Skeleton className="h-32 w-full bg-deep-iris/20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminAccess() {
  const { data, error, isLoading, mutate } = useAdminAccess();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message="Failed to load access data" onRetry={() => mutate()} />;
  if (!data) return null;

  const confirmAndExecute = async (action: () => Promise<void>, key: string) => {
    setPending(null);
    setLoadingAction(key);
    try {
      await action();
      mutate();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRoleChange = (memberId: string, newRole: string, currentRole: string, address: string) => {
    if (newRole === currentRole) return;
    setPending({
      type: "role",
      id: memberId,
      label: `Change role to "${newRole}" for ${address.slice(0, 10)}...?`,
      meta: `${memberId}:${newRole}:${address}`,
    });
  };

  const confirmRoleChange = async () => {
    if (!pending?.meta) return;
    const [memberId, newRole, address] = pending.meta.split(":");
    await confirmAndExecute(async () => {
      await changeUserRole(memberId, newRole);
      toast.success(`Role updated for ${address.slice(0, 10)}...`);
    }, `role-${memberId}`);
  };

  const handleRevokeSession = (sessionId: string) => {
    setPending({
      type: "revoke",
      id: sessionId,
      label: "Revoke this session? The user will be logged out.",
    });
  };

  const confirmRevoke = async () => {
    if (!pending) return;
    await confirmAndExecute(async () => {
      await revokeSession(pending.id);
      toast.success("Session revoked");
    }, `session-${pending.id}`);
  };

  const handleDisableKey = (keyId: string, keyName: string) => {
    setPending({
      type: "disable-key",
      id: keyId,
      label: `Disable API key "${keyName}"? This cannot be undone.`,
    });
  };

  const confirmDisableKey = async () => {
    if (!pending) return;
    await confirmAndExecute(async () => {
      await disableApiKey(pending.id);
      toast.success("API key disabled");
    }, `key-${pending.id}`);
  };

  const handleConfirm = () => {
    if (pending?.type === "role") confirmRoleChange();
    else if (pending?.type === "revoke") confirmRevoke();
    else if (pending?.type === "disable-key") confirmDisableKey();
  };

  return (
    <div className="space-y-6">
      {/* Confirm banner */}
      {pending && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-DEFAULT/30 bg-amber-DEFAULT/5 px-4 py-3">
          <p className="text-xs text-amber-DEFAULT">{pending.label}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPending(null)}
              className="h-6 px-2 text-[10px] text-dusty-lavender/70 hover:text-mist"
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConfirm}
              className="h-6 px-2 text-[10px] text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
            >
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Members */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
            <Users className="size-4 text-soft-violet" />
            Members ({data.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No members</p>
          ) : (
            <div className="space-y-3">
              {data.members.map((member) => (
                <div key={member.id} className="rounded-lg bg-deep-iris/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-mist" title={member.address}>
                        {member.address.slice(0, 12)}...{member.address.slice(-4)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-dusty-lavender/50">
                        Joined {timeAgo(member.joinedAt)} &middot; {member.activeSessions} active session{member.activeSessions !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value, member.role, member.address)}
                        disabled={loadingAction === `role-${member.id}`}
                        className={cn(
                          "rounded-md border-0 px-2 py-1 text-[10px] font-medium",
                          ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer,
                          "cursor-pointer focus:outline-none focus:ring-1 focus:ring-soft-violet/50",
                        )}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sessions */}
                  {member.sessions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {member.sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between rounded bg-slate-dark/30 px-2 py-1">
                          <span className="text-[10px] text-dusty-lavender/50">
                            Session &middot; expires {timeAgo(session.expiresAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeSession(session.id)}
                            disabled={loadingAction === `session-${session.id}`}
                            className="h-5 px-1.5 text-[10px] text-rose-DEFAULT/70 hover:text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
                          >
                            <XCircle className="size-3 mr-0.5" />
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
            <Key className="size-4 text-amber-DEFAULT" />
            API Keys ({data.apiKeys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.apiKeys.length === 0 ? (
            <p className="py-4 text-center text-xs text-dusty-lavender/50">No API keys</p>
          ) : (
            <div className="space-y-2">
              {data.apiKeys.map((key) => (
                <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-deep-iris/10 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-mist">{key.name}</p>
                      <span className="font-mono text-[10px] text-dusty-lavender/40">{key.keyPrefix}...</span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        key.tier === "pro" ? "bg-soft-violet/15 text-soft-violet" : "bg-dusty-lavender/10 text-dusty-lavender/50",
                      )}>
                        {key.tier}
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        key.isActive ? "bg-teal-DEFAULT/15 text-teal-DEFAULT" : "bg-rose-DEFAULT/15 text-rose-DEFAULT",
                      )}>
                        {key.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-dusty-lavender/50">
                      {key.lastUsedAt ? `Last used ${timeAgo(key.lastUsedAt)}` : "Never used"}
                    </p>
                  </div>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisableKey(key.id, key.name)}
                      disabled={loadingAction === `key-${key.id}`}
                      className="h-6 px-2 text-[10px] text-rose-DEFAULT/70 hover:text-rose-DEFAULT hover:bg-rose-DEFAULT/10"
                    >
                      <Ban className="size-3 mr-0.5" />
                      Disable
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
