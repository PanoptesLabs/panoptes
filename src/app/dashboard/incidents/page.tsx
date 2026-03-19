"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { IncidentList } from "@/components/dashboard/incident-list";

export default function IncidentsPage() {
  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Active and historical incidents"
      />
      <WorkspaceGuard>
        <IncidentList />
      </WorkspaceGuard>
    </div>
  );
}
