"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { LeaderboardTable } from "@/components/dashboard/leaderboard-table";

export default function LeaderboardPage() {
  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description="Validator rankings across performance categories"
      />
      <LeaderboardTable />
    </div>
  );
}
