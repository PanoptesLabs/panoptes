"use client";

import { useState, useRef, useCallback } from "react";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { ErrorState } from "./error-state";
import { ScoreBadge } from "./score-badge";
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
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Trophy,
  ArrowUpCircle,
  Percent,
  Vote,
  TrendingUp,
  Users,
  Cpu,
} from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { SearchInput } from "./search-input";
import { Pagination } from "./pagination";
import { useComputeLeaderboard } from "@/hooks/use-compute";

const CATEGORIES = [
  { key: "overall", label: "Overall", icon: Trophy },
  { key: "uptime", label: "Uptime", icon: ArrowUpCircle },
  { key: "commission", label: "Commission", icon: Percent },
  { key: "governance", label: "Governance", icon: Vote },
  { key: "rising", label: "Rising", icon: TrendingUp },
  { key: "stake_magnet", label: "Stake Magnet", icon: Users },
  { key: "compute", label: "Compute", icon: Cpu },
] as const;

function formatValue(category: string, value: number): string {
  switch (category) {
    case "uptime":
      return `${(value * 100).toFixed(2)}%`;
    case "commission":
      return `${(value * 100).toFixed(2)}%`;
    case "governance":
      return `${(value * 100).toFixed(1)}%`;
    case "rising":
      return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    case "stake_magnet":
      return value >= 0 ? `+${value}` : `${value}`;
    case "compute":
      return value.toLocaleString();
    default:
      return value.toFixed(2);
  }
}

const PAGE_SIZE = 20;

export function LeaderboardTable() {
  const [category, setCategory] = useState("overall");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const isCompute = category === "compute";
  const { data, error, isLoading, mutate } = useLeaderboard(isCompute ? undefined : category);
  const { data: computeData, error: computeError, isLoading: computeLoading, mutate: computeMutate } = useComputeLeaderboard();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeData = isCompute ? computeData : data;
  const activeError = isCompute ? computeError : error;
  const activeLoading = isCompute ? computeLoading : isLoading;
  const activeMutate = isCompute ? computeMutate : mutate;

  // Normalize compute entries to the standard leaderboard shape
  const entries = isCompute
    ? (computeData?.entries ?? []).map((e, i) => ({
        rank: i + 1,
        validatorId: e.target_validator,
        moniker: e.moniker || e.target_validator.slice(0, 12),
        value: e.total_jobs,
        score: e.success_rate,
      }))
    : data?.entries ?? [];
  const filteredEntries = search
    ? entries.filter((e) => e.moniker.toLowerCase().includes(search.toLowerCase()))
    : entries;
  const pagedEntries = filteredEntries.slice(offset, offset + PAGE_SIZE);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        next = (index + 1) % CATEGORIES.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        next = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
      } else if (e.key === "Home") {
        next = 0;
      } else if (e.key === "End") {
        next = CATEGORIES.length - 1;
      }
      if (next >= 0) {
        e.preventDefault();
        setCategory(CATEGORIES[next].key);
        setSearch("");
        setOffset(0);
        tabRefs.current[next]?.focus();
      }
    },
    [],
  );

  if (activeError && !activeData) {
    return <ErrorState message="Failed to load leaderboard" onRetry={() => activeMutate()} />;
  }

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard categories">
        {CATEGORIES.map((cat, index) => {
          const active = category === cat.key;
          return (
            <button
              key={cat.key}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`leaderboard-tab-${cat.key}`}
              aria-selected={active}
              aria-controls="leaderboard-tabpanel"
              tabIndex={active ? 0 : -1}
              onClick={() => { setCategory(cat.key); setSearch(""); setOffset(0); }}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "border-soft-violet/50 bg-soft-violet/15 text-soft-violet"
                  : "border-slate-DEFAULT/20 text-dusty-lavender/70 hover:border-slate-DEFAULT/40 hover:text-dusty-lavender",
              )}
            >
              <cat.icon className="size-4" />
              {cat.label}
              <HelpTooltip
                content={helpContent.leaderboard.categories[cat.key as keyof typeof helpContent.leaderboard.categories]}
                side="bottom"
              />
            </button>
          );
        })}
      </div>

      {/* Search */}
      <SearchInput
        key={category}
        placeholder="Search validator..."
        onSearch={(q) => { setSearch(q); setOffset(0); }}
        className="max-w-sm"
      />

      {/* Table */}
      <Card
        id="leaderboard-tabpanel"
        role="tabpanel"
        aria-labelledby={`leaderboard-tab-${category}`}
        className="border-slate-DEFAULT/20 bg-midnight-plum"
      >
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
                <TableHead className="w-16 text-dusty-lavender/70">Rank</TableHead>
                <TableHead className="text-dusty-lavender/70">Validator</TableHead>
                <TableHead className="text-right text-dusty-lavender/70">
                  {isCompute ? "Total Jobs" : "Value"}
                </TableHead>
                <TableHead className="w-20 text-right text-dusty-lavender/70">
                  {isCompute ? "Success %" : "Score"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLoading && !activeData
                ? Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-DEFAULT/10">
                      <TableCell>
                        <Skeleton className="h-5 w-8 bg-deep-iris/20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-40 bg-deep-iris/20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-5 w-20 bg-deep-iris/20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-5 w-12 bg-deep-iris/20" />
                      </TableCell>
                    </TableRow>
                  ))
                : pagedEntries.length === 0
                  ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-dusty-lavender/50"
                        >
                          {search ? "No validators matching your search" : "No validators found"}
                        </TableCell>
                      </TableRow>
                    )
                  : pagedEntries.map((entry) => (
                      <TableRow
                        key={entry.validatorId}
                        className="border-slate-DEFAULT/10 cursor-pointer transition-colors hover:bg-deep-iris/10"
                      >
                        <TableCell className="font-mono text-sm text-dusty-lavender/70">
                          <Link href={`/dashboard/validators/${entry.validatorId}`} className="block">
                            #{entry.rank}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-mist">
                          <Link href={`/dashboard/validators/${entry.validatorId}`} className="block">
                            {entry.moniker}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-dusty-lavender">
                          <Link href={`/dashboard/validators/${entry.validatorId}`} className="block">
                            {formatValue(category, entry.value)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/validators/${entry.validatorId}`} className="block">
                            {isCompute ? (
                              <span className="font-mono text-sm text-dusty-lavender">
                                {entry.score.toFixed(1)}%
                              </span>
                            ) : (
                              <ScoreBadge score={entry.score} />
                            )}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </CardContent>
        {filteredEntries.length > PAGE_SIZE && (
          <div className="border-t border-slate-DEFAULT/20 px-4 py-3">
            <Pagination
              total={filteredEntries.length}
              limit={PAGE_SIZE}
              offset={offset}
              onPageChange={setOffset}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
