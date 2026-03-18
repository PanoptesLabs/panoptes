"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWebhookDetail, useWebhookDeliveries, testWebhook, deleteWebhook } from "@/hooks/use-webhooks";
import { ErrorState } from "./error-state";
import { DataTable, type Column } from "./data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { Play, Trash2, Loader2 } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import type { WebhookDeliveryItem } from "@/types";

interface WebhookDetailProps {
  webhookId: string;
}

const deliveryColumns: Column<WebhookDeliveryItem>[] = [
  {
    key: "eventType",
    header: "Event",
    render: (row) => (
      <span className="font-mono text-xs text-mist">{row.eventType}</span>
    ),
  },
  {
    key: "statusCode",
    header: "Status",
    render: (row) => (
      <span className={cn("font-mono text-xs", row.success ? "text-teal-DEFAULT" : "text-rose-DEFAULT")}>
        {row.statusCode ?? "--"}
      </span>
    ),
  },
  {
    key: "success",
    header: "Result",
    render: (row) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
          row.success
            ? "border-teal-DEFAULT/30 bg-teal-dark/50 text-teal-light"
            : "border-rose-DEFAULT/30 bg-rose-dark/50 text-rose-light",
        )}
      >
        {row.success ? "Success" : "Failed"}
      </span>
    ),
  },
  {
    key: "attempts",
    header: "Attempts",
    render: (row) => (
      <span className="text-xs text-dusty-lavender/70">{row.attempts}</span>
    ),
  },
  {
    key: "createdAt",
    header: "Time",
    render: (row) => (
      <span className="text-xs text-dusty-lavender/50">{timeAgo(row.createdAt)}</span>
    ),
  },
];

export function WebhookDetail({ webhookId }: WebhookDetailProps) {
  const router = useRouter();
  const { token } = useWorkspace();
  const { data: webhook, error, isLoading, mutate } = useWebhookDetail(token, webhookId);
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const { data: deliveryData, isLoading: deliveriesLoading } = useWebhookDeliveries(token, webhookId, {
    limit: 20,
    offset: deliveryOffset,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
      </div>
    );
  }

  if (error || !webhook) {
    return <ErrorState message="Failed to load webhook" onRetry={() => mutate()} />;
  }

  const handleTest = async () => {
    if (!token) return;
    setActionLoading("test");
    setActionError(null);
    setTestSuccess(false);
    try {
      await testWebhook(token, webhookId);
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
    } catch {
      setActionError("Test delivery failed. Check the webhook URL.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setDeleteCountdown(5);
      clearCountdown();
      countdownRef.current = setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev <= 1) {
            clearCountdown();
            setConfirmDelete(false);
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    setActionLoading("delete");
    setActionError(null);
    try {
      await deleteWebhook(token, webhookId);
      router.push("/dashboard/settings/webhooks");
    } catch {
      setActionError("Failed to delete webhook. Please try again.");
      setActionLoading(null);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Webhook info */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-medium text-mist">{webhook.name}</h2>
              <p className="mt-1 break-all text-sm text-dusty-lavender/50">{webhook.url}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {webhook.events.map((event) => (
                  <span
                    key={event}
                    className="rounded-full border border-soft-violet/30 bg-soft-violet/10 px-2.5 py-0.5 text-[11px] font-medium text-soft-violet"
                  >
                    {event}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    webhook.isActive
                      ? "border-teal-DEFAULT/30 bg-teal-dark/50 text-teal-light"
                      : "border-slate-DEFAULT/30 bg-slate-dark/50 text-slate-light",
                  )}
                >
                  {webhook.isActive ? "Active" : "Inactive"}
                </span>
                <span className="text-xs text-dusty-lavender/40">
                  Created {timeAgo(webhook.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={actionLoading !== null}
                className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
              >
                {actionLoading === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Test
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={actionLoading !== null}
              >
                {actionLoading === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {confirmDelete ? `Confirm Delete (${deleteCountdown}s)` : "Delete"}
              </Button>
            </div>
          </div>
          {(actionError || testSuccess) && (
            <div className={cn(
              "mt-3 rounded-lg border px-4 py-2.5 text-xs",
              testSuccess
                ? "border-teal-DEFAULT/30 bg-teal-dark/10 text-teal-light"
                : "border-rose-DEFAULT/30 bg-rose-dark/10 text-rose-light",
            )}>
              {testSuccess ? "Test delivery sent successfully." : actionError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery log */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1 text-sm font-medium text-dusty-lavender/70">
            Delivery Log
            <HelpTooltip content={helpContent.webhooks.concepts.deliveryLog} side="right" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={deliveryColumns}
            data={deliveryData?.deliveries ?? []}
            total={deliveryData?.total ?? 0}
            limit={20}
            offset={deliveryOffset}
            onPageChange={setDeliveryOffset}
            isLoading={deliveriesLoading}
            emptyMessage="No deliveries yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
