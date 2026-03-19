"use client";

import { use } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { IncidentDetail } from "@/components/dashboard/incident-detail";

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div>
      <PageHeader
        title="Incident Detail"
      />
      <WorkspaceGuard>
        <IncidentDetail incidentId={id} />
      </WorkspaceGuard>
    </div>
  );
}
