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
      <div className="grid gap-6 lg:grid-cols-2">
        <DelegationFlow />
        <DelegationList />
      </div>
      <div className="mt-6">
        <WhaleMovements />
      </div>
    </div>
  );
}
