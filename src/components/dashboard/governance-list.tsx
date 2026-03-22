"use client";

import { useState } from "react";
import Link from "next/link";
import { useGovernanceProposals } from "@/hooks/use-governance";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { Loader2, Vote, CheckCircle, XCircle, Clock, Ban } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PROPOSAL_STATUS_VOTING_PERIOD: { label: "Voting", color: "text-amber-DEFAULT", icon: Clock },
  PROPOSAL_STATUS_PASSED: { label: "Passed", color: "text-teal-DEFAULT", icon: CheckCircle },
  PROPOSAL_STATUS_REJECTED: { label: "Rejected", color: "text-rose-DEFAULT", icon: XCircle },
  PROPOSAL_STATUS_FAILED: { label: "Failed", color: "text-rose-DEFAULT", icon: Ban },
  PROPOSAL_STATUS_DEPOSIT_PERIOD: { label: "Deposit", color: "text-dusty-lavender/50", icon: Clock },
};

export function GovernanceList() {
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const { data, error, isLoading, mutate } = useGovernanceProposals({ limit, offset });

  if (error && !data) return <ErrorState message="Failed to load governance data" onRetry={() => mutate()} />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const proposals = data?.proposals ?? [];

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={<Vote className="size-5 text-dusty-lavender/60" />}
        title="No governance proposals found"
        description="Governance proposals will appear here when submitted on-chain."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dusty-lavender/50">{data?.total ?? 0} proposals</p>
      </div>
      {proposals.map((p) => {
        const config = STATUS_CONFIG[p.status] || { label: p.status, color: "text-dusty-lavender/50", icon: Clock };
        const StatusIcon = config.icon;

        return (
          <Link key={p.id} href={`/dashboard/governance/${p.id}`}>
            <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-soft-violet/15">
                  <Vote className="size-4 text-soft-violet" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-dusty-lavender/60">#{p.id}</span>
                    <p className="truncate font-medium text-mist">{p.title}</p>
                  </div>
                  <p className="text-xs text-dusty-lavender/50">
                    {p.submitTime ? `Submitted ${timeAgo(p.submitTime)}` : "Unknown"}
                    {p.votingEndTime && ` · Voting ends ${timeAgo(p.votingEndTime)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={`size-3.5 ${config.color}`} />
                  <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
      {(data?.total ?? 0) > limit && (
        <Pagination total={data?.total ?? 0} limit={limit} offset={offset} onPageChange={setOffset} />
      )}
    </div>
  );
}
