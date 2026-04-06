"use client";

import { useState } from "react";
import { useDelegationFlow } from "@/hooks/use-delegations";
import { ErrorState } from "./error-state";
import { Pagination } from "./pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { formatAmountShort, truncateAddress } from "@/lib/formatters";
import { SearchInput } from "./search-input";

const PAGE_SIZE = 20;

export function DelegationFlow() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, isLoading, mutate } = useDelegationFlow(7);

  const flow = data?.flow ?? [];
  const filteredFlow = search
    ? flow.filter((v) => {
        const q = search.toLowerCase();
        return (v.moniker?.toLowerCase().includes(q)) || v.validatorId.toLowerCase().includes(q);
      })
    : flow;
  const maxPage = Math.max(0, Math.ceil(filteredFlow.length / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const paginatedFlow = filteredFlow.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (error) return <ErrorState message="Failed to load delegation flow" onRetry={() => mutate()} />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  if (flow.length === 0) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="flex flex-col items-center py-12">
          <ArrowLeftRight className="mb-3 size-8 text-dusty-lavender/50" />
          <p className="text-sm text-dusty-lavender/50">No delegation flow data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm text-mist">
            Validator Delegation Flow (Last {data.days} days)
          </CardTitle>
          <SearchInput
            placeholder="Search validator..."
            onSearch={(q) => { setSearch(q); setPage(0); }}
            className="sm:w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-4 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-dusty-lavender/50 md:grid-cols-4">
            <span>Validator</span>
            <span className="text-right">Delegators</span>
            <span className="text-right">Total Delegated</span>
            <span className="flex items-center justify-end gap-1">
              Churn Rate
              <HelpTooltip content={helpContent.delegations.fields.churnRate} side="left" />
            </span>
          </div>
          {paginatedFlow.map((v) => (
            <div key={v.validatorId} className="grid grid-cols-2 gap-4 rounded bg-slate-dark/20 px-3 py-2 text-xs md:grid-cols-4">
              <span className="font-mono text-dusty-lavender truncate" title={v.validatorId}>{v.moniker || truncateAddress(v.validatorId, 8, 6)}</span>
              <span className="text-right text-mist">{v.latestDelegators}</span>
              <span className="text-right font-mono text-mist">
                {formatAmountShort(v.latestDelegated)}
              </span>
              <span className="flex items-center justify-end gap-1">
                {v.avgChurnRate > 5 ? (
                  <TrendingUp className="size-3 text-rose-DEFAULT" />
                ) : (
                  <TrendingDown className="size-3 text-teal-DEFAULT" />
                )}
                <span className={v.avgChurnRate > 5 ? "text-rose-DEFAULT" : "text-teal-DEFAULT"}>
                  {v.avgChurnRate.toFixed(1)}%
                </span>
              </span>
            </div>
          ))}
        </div>
        {filteredFlow.length > PAGE_SIZE && (
          <div className="mt-4">
            <Pagination
              total={filteredFlow.length}
              limit={PAGE_SIZE}
              offset={safePage * PAGE_SIZE}
              onPageChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
