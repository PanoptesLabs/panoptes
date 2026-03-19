"use client";

import { use } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { PolicyDetail } from "@/components/dashboard/policy-detail";

export default function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div>
      <PageHeader
        title="Policy Detail"
        description="View and manage policy configuration"
      />
      <WorkspaceGuard>
        <PolicyDetail policyId={id} />
      </WorkspaceGuard>
    </div>
  );
}
