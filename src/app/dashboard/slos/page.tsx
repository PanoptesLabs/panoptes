"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { SloList } from "@/components/dashboard/slo-list";

export default function SlosPage() {
  return (
    <div>
      <PageHeader
        title="SLOs"
        description="Service Level Objectives — reliability targets"
        breadcrumbs={[{ label: "SLOs" }]}
      />
      <WorkspaceGuard>
        <SloList />
      </WorkspaceGuard>
    </div>
  );
}
