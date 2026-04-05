"use client";

import { useState } from "react";
import { useComputeJobs } from "@/hooks/use-compute";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterSelect } from "@/components/dashboard/filter-select";
import { SearchInput } from "@/components/dashboard/search-input";
import { ErrorState } from "@/components/dashboard/error-state";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/dashboard/pagination";
import { HelpTooltip } from "@/components/dashboard/help-tooltip";
import { helpContent } from "@/lib/help-content";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAmountShort, truncateAddress } from "@/lib/formatters";
import { timeAgo } from "@/lib/time";
import { parseModelName } from "@/lib/yaci";
import Link from "next/link";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
];

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-teal-DEFAULT/15 text-teal-DEFAULT",
  PENDING: "bg-amber-DEFAULT/15 text-amber-DEFAULT",
  FAILED: "bg-rose-DEFAULT/15 text-rose-DEFAULT",
};

export default function ComputeJobsPage() {
  const [status, setStatus] = useState("");
  const [validator, setValidator] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, error, isLoading, mutate } = useComputeJobs({
    status: status || undefined,
    validator: validator || undefined,
    limit,
    offset,
  });

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Compute Jobs"
          description="Browse AI/ML compute jobs processed by validators"
        />
        <ErrorState message="Failed to load compute jobs" onRetry={() => mutate()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compute Jobs"
        description="Browse AI/ML compute jobs processed by validators"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1">
          <FilterSelect
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => { setStatus(v); setOffset(0); }}
          />
          {status && helpContent.compute?.statuses?.[status as keyof typeof helpContent.compute.statuses] && (
            <HelpTooltip
              content={helpContent.compute.statuses[status as keyof typeof helpContent.compute.statuses]}
              side="right"
            />
          )}
        </div>
        <SearchInput
          placeholder="Filter by validator address..."
          onSearch={(q) => { setValidator(q); setOffset(0); }}
          className="max-w-sm"
        />
      </div>

      {isLoading && !data && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
                  <TableHead className="text-dusty-lavender/70">Job ID</TableHead>
                  <TableHead className="text-dusty-lavender/70">Status</TableHead>
                  <TableHead className="text-dusty-lavender/70">Validator</TableHead>
                  <TableHead className="text-dusty-lavender/70">Model</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Fee</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-DEFAULT/10">
                    <TableCell><Skeleton className="h-5 w-12 bg-deep-iris/20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-deep-iris/20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28 bg-deep-iris/20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-deep-iris/20" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-5 w-16 bg-deep-iris/20" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-5 w-16 bg-deep-iris/20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.jobs.length === 0 && (
        <EmptyState
          icon={<Cpu className="size-5 text-dusty-lavender/60" />}
          title="No compute jobs found"
          description="Jobs will appear here as validators process AI/ML workloads."
        />
      )}

      {data && data.jobs.length > 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
                  <TableHead className="text-dusty-lavender/70">Job ID</TableHead>
                  <TableHead className="text-dusty-lavender/70">Status</TableHead>
                  <TableHead className="text-dusty-lavender/70">Validator</TableHead>
                  <TableHead className="text-dusty-lavender/70">Model</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Fee</TableHead>
                  <TableHead className="text-right text-dusty-lavender/70">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.jobs.map((job) => (
                  <TableRow
                    key={job.job_id}
                    className="border-slate-DEFAULT/10 transition-colors hover:bg-deep-iris/10"
                  >
                    <TableCell className="font-mono text-sm text-dusty-lavender/70">
                      #{job.job_id}
                    </TableCell>
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
                    <TableCell>
                      <Link
                        href={`/dashboard/validators/${job.target_validator}`}
                        className="font-mono text-sm text-soft-violet hover:underline"
                      >
                        {truncateAddress(job.target_validator)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-mist">
                      {parseModelName(job.execution_image)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-dusty-lavender">
                      {formatAmountShort(job.fee_amount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-dusty-lavender/60">
                      {timeAgo(job.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          {data.total > limit && (
            <div className="border-t border-slate-DEFAULT/20 px-4 py-3">
              <Pagination
                total={data.total}
                limit={limit}
                offset={offset}
                onPageChange={setOffset}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
