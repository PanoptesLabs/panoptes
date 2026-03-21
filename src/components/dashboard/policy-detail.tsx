"use client";

import { useState } from "react";
import { usePolicyDetail, updatePolicy, deletePolicy, testPolicy } from "@/hooks/use-policies";
import { useAsyncAction } from "@/hooks/use-async-action";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/time";
import { useRouter } from "next/navigation";
import {
  ScrollText,
  Loader2,
  Play,
  Pause,
  Trash2,
  TestTube,
} from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { AuthGate } from "./auth-gate";

export function PolicyDetail({ policyId }: { policyId: string }) {
  const { data, error, isLoading, mutate } = usePolicyDetail(policyId);
  const router = useRouter();

  const toggle = useAsyncAction();
  const dryRunToggle = useAsyncAction();
  const del = useAsyncAction();
  const test = useAsyncAction<Record<string, unknown>>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const actionError = toggle.error || dryRunToggle.error || del.error || test.error;

  const handleToggleActive = async () => {
    if (!data) return;
    await toggle.execute(async () => {
      await updatePolicy(policyId, { isActive: !data.isActive });
      mutate();
    }, "Failed to toggle policy status.");
  };

  const handleToggleDryRun = async () => {
    if (!data) return;
    await dryRunToggle.execute(async () => {
      await updatePolicy(policyId, { dryRun: !data.dryRun });
      mutate();
    }, "Failed to toggle dry run mode.");
  };

  const handleDelete = async () => {
    await del.execute(async () => {
      await deletePolicy(policyId);
      router.push("/dashboard/settings/policies");
    }, "Failed to delete policy.");
  };

  const handleTest = async () => {
    setTestResult(null);
    const result = await test.execute(
      () => testPolicy(policyId),
      "Failed to test policy.",
    );
    if (result) setTestResult(result);
  };

  if (error) return <ErrorState message="Failed to load policy" />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-mist">
              <ScrollText className="size-4 text-soft-violet" />
              {data.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {data.dryRun && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-DEFAULT/15 px-2 py-0.5 text-xs font-medium text-amber-DEFAULT">
                  DRY RUN
                  <HelpTooltip content={helpContent.policies.concepts.dryRun} side="bottom" />
                </span>
              )}
              <span className={`text-xs ${data.isActive ? "text-teal-DEFAULT" : "text-dusty-lavender/40"}`}>
                {data.isActive ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.description && (
            <p className="text-sm text-dusty-lavender/70">{data.description}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-1 text-xs text-dusty-lavender/50">
                Priority
                <HelpTooltip content={helpContent.policies.concepts.priority} side="right" />
              </p>
              <p className="font-mono text-sm text-mist">{data.priority}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-dusty-lavender/50">
                Cooldown
                <HelpTooltip content={helpContent.policies.concepts.cooldown} side="right" />
              </p>
              <p className="text-sm text-mist">{data.cooldownMinutes} min</p>
            </div>
            <div>
              <p className="text-xs text-dusty-lavender/50">Last Triggered</p>
              <p className="text-sm text-mist">
                {data.lastTriggeredAt ? timeAgo(data.lastTriggeredAt) : "Never"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AuthGate requiredRole="editor" onAction={handleToggleActive}>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isLoading}
                className="border-slate-DEFAULT/20"
              >
                {toggle.isLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : data.isActive ? (
                  <Pause className="size-3" />
                ) : (
                  <Play className="size-3" />
                )}
                {data.isActive ? "Pause" : "Activate"}
              </Button>
            </AuthGate>
            <AuthGate requiredRole="editor" onAction={handleToggleDryRun}>
              <Button
                size="sm"
                variant="outline"
                disabled={dryRunToggle.isLoading}
                className="border-slate-DEFAULT/20"
              >
                {dryRunToggle.isLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <TestTube className="size-3" />
                )}
                {data.dryRun ? "Enable Live" : "Enable Dry Run"}
              </Button>
            </AuthGate>
            <AuthGate requiredRole="editor" onAction={handleTest}>
              <Button
                size="sm"
                variant="outline"
                disabled={test.isLoading}
                className="border-slate-DEFAULT/20"
              >
                {test.isLoading ? <Loader2 className="size-3 animate-spin" /> : <TestTube className="size-3" />}
                Test
              </Button>
            </AuthGate>
            {showDeleteConfirm ? (
              <div className="flex gap-1">
                <AuthGate requiredRole="editor" onAction={handleDelete}>
                  <Button size="sm" variant="destructive" disabled={del.isLoading}>
                    {del.isLoading ? <Loader2 className="size-3 animate-spin" /> : "Confirm Delete"}
                  </Button>
                </AuthGate>
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <AuthGate requiredRole="editor" onAction={() => setShowDeleteConfirm(true)}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-DEFAULT hover:text-rose-DEFAULT/80"
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              </AuthGate>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Error */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-DEFAULT/30 bg-rose-dark/10 px-4 py-2.5 text-xs text-rose-light">
          {actionError}
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <Card className="border-teal-DEFAULT/20 bg-midnight-plum">
          <CardHeader>
            <CardTitle className="text-sm text-mist">Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-slate-dark/50 p-3 font-mono text-xs text-dusty-lavender">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">Conditions ({data.conditions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-slate-dark/30 px-3 py-2 text-xs">
                <code className="text-soft-violet">{c.field}</code>
                {helpContent.policies.conditionFields[c.field as keyof typeof helpContent.policies.conditionFields] && (
                  <HelpTooltip
                    content={helpContent.policies.conditionFields[c.field as keyof typeof helpContent.policies.conditionFields]}
                    side="top"
                  />
                )}
                <span className="text-amber-DEFAULT">{c.operator}</span>
                {helpContent.policies.operators[c.operator as keyof typeof helpContent.policies.operators] && (
                  <HelpTooltip
                    content={helpContent.policies.operators[c.operator as keyof typeof helpContent.policies.operators]}
                    side="top"
                  />
                )}
                <code className="text-teal-DEFAULT">{JSON.stringify(c.value)}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">Actions ({data.actions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-slate-dark/30 px-3 py-2 text-xs">
                <span className="rounded bg-soft-violet/15 px-2 py-0.5 font-medium text-soft-violet">
                  {a.type}
                </span>
                {helpContent.policies.actionTypes[a.type as keyof typeof helpContent.policies.actionTypes] && (
                  <HelpTooltip
                    content={helpContent.policies.actionTypes[a.type as keyof typeof helpContent.policies.actionTypes]}
                    side="right"
                  />
                )}
                {a.config && (
                  <code className="text-dusty-lavender/50">{JSON.stringify(a.config)}</code>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.executions && data.executions.length > 0 ? (
            <div className="space-y-2">
              {data.executions.map((exec) => (
                <div key={exec.id} className="rounded border border-slate-DEFAULT/10 bg-slate-dark/20 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-mist">{exec.triggerEntity}</span>
                    <div className="flex items-center gap-2">
                      {exec.dryRun && (
                        <span className="text-amber-DEFAULT">DRY RUN</span>
                      )}
                      <span className="text-dusty-lavender/50">{timeAgo(exec.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-dusty-lavender/40">No executions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
