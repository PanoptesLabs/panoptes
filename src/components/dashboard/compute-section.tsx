"use client";

import { useValidatorCompute } from "@/hooks/use-compute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Cpu, CheckCircle, Percent, Clock } from "lucide-react";
import { formatAmountShort } from "@/lib/formatters";
import { timeAgo } from "@/lib/time";
import { parseModelName } from "@/lib/yaci";
import { cn } from "@/lib/utils";

interface ComputeSectionProps {
  validatorId: string;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-teal-DEFAULT/15 text-teal-DEFAULT",
  PENDING: "bg-amber-DEFAULT/15 text-amber-DEFAULT",
  FAILED: "bg-rose-DEFAULT/15 text-rose-DEFAULT",
};

function successRateColor(rate: number): string {
  if (rate >= 80) return "text-teal-DEFAULT";
  if (rate >= 50) return "text-amber-DEFAULT";
  return "text-rose-DEFAULT";
}

export function ComputeSection({ validatorId }: ComputeSectionProps) {
  const { data, isLoading } = useValidatorCompute(validatorId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist">
          <Cpu className="size-5 text-soft-violet" />
          Compute Performance
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-deep-iris/20" />
          ))}
        </div>
      </div>
    );
  }

  // Nothing to show at all — no stats, no models, no jobs
  const hasStats = !!data?.stats;
  const models = data?.models ?? [];
  const recentJobs = data?.recentJobs ?? [];
  const hasContent = hasStats || models.length > 0 || recentJobs.length > 0;

  if (!hasContent) {
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist">
          <Cpu className="size-5 text-soft-violet" />
          Compute Performance
        </h2>
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-sm text-dusty-lavender/50">No compute data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist">
        <Cpu className="size-5 text-soft-violet" />
        Compute Performance
      </h2>

      {/* Stat cards — only when leaderboard data is available */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1.5 text-xs text-dusty-lavender/50">
                <Cpu className="size-3" />
                Total Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xl font-bold text-mist">
                {stats.total_jobs.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1.5 text-xs text-dusty-lavender/50">
                <CheckCircle className="size-3" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xl font-bold text-teal-DEFAULT">
                {stats.completed_jobs.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1.5 text-xs text-dusty-lavender/50">
                <Percent className="size-3" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("font-mono text-xl font-bold", successRateColor(stats.success_rate))}>
                {stats.success_rate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recently used models */}
      {models.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-dusty-lavender/70">Recently Used Models</h3>
          <div className="flex flex-wrap gap-2">
            {models.map((model) => (
              <span
                key={model}
                className="inline-flex items-center rounded-full border border-soft-violet/20 bg-soft-violet/10 px-3 py-1 text-xs font-medium text-soft-violet"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent jobs table */}
      {recentJobs.length > 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dusty-lavender/70">Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
                  <TableHead className="text-dusty-lavender/70">Status</TableHead>
                  <TableHead className="text-dusty-lavender/70">Model</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Fee</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.job_id} className="border-slate-DEFAULT/10">
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          STATUS_STYLES[job.status] ?? STATUS_STYLES.PENDING,
                        )}
                      >
                        {job.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-mist">
                      {parseModelName(job.execution_image)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-dusty-lavender">
                      {formatAmountShort(job.fee_amount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-dusty-lavender/60">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="size-3" />
                        {timeAgo(job.created_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
