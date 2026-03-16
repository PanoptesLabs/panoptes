"use client";

import { useState } from "react";
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
import {
  Trophy,
  ArrowUpCircle,
  Percent,
  Vote,
  TrendingUp,
  Users,
} from "lucide-react";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";

const CATEGORIES = [
  { key: "overall", label: "Overall", icon: Trophy },
  { key: "uptime", label: "Uptime", icon: ArrowUpCircle },
  { key: "commission", label: "Commission", icon: Percent },
  { key: "governance", label: "Governance", icon: Vote },
  { key: "rising", label: "Rising", icon: TrendingUp },
  { key: "stake_magnet", label: "Stake Magnet", icon: Users },
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
    default:
      return value.toFixed(2);
  }
}

export function LeaderboardTable() {
  const [category, setCategory] = useState("overall");
  const { data, error, isLoading, mutate } = useLeaderboard(category);

  if (error && !data) {
    return <ErrorState message="Failed to load leaderboard" onRetry={() => mutate()} />;
  }

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
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

      {/* Table */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
                <TableHead className="w-16 text-dusty-lavender/70">Rank</TableHead>
                <TableHead className="text-dusty-lavender/70">Validator</TableHead>
                <TableHead className="text-right text-dusty-lavender/70">Value</TableHead>
                <TableHead className="w-20 text-right text-dusty-lavender/70">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !data
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
                : data && data.entries.length === 0
                  ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-dusty-lavender/50"
                        >
                          No validators found
                        </TableCell>
                      </TableRow>
                    )
                  : data?.entries.map((entry) => (
                      <TableRow
                        key={entry.validatorId}
                        className="border-slate-DEFAULT/10 transition-colors hover:bg-deep-iris/10"
                      >
                        <TableCell className="font-mono text-sm text-dusty-lavender/70">
                          #{entry.rank}
                        </TableCell>
                        <TableCell className="font-medium text-mist">
                          {entry.moniker}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-dusty-lavender">
                          {formatValue(category, entry.value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ScoreBadge score={entry.score} />
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
