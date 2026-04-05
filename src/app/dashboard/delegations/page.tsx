"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { DelegationList } from "@/components/dashboard/delegation-list";
import { DelegationFlow } from "@/components/dashboard/delegation-flow";
import { WhaleMovements } from "@/components/dashboard/whale-movements";

export default function DelegationsPage() {
  return (
    <div>
      <PageHeader
        title="Delegations"
        description="Stake movements, delegation flow, and whale detection"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DelegationFlow />
          <DelegationList />
        </div>
        <div className="lg:col-span-1">
          <WhaleMovements />
        </div>
      </div>
    </div>
  );
}
