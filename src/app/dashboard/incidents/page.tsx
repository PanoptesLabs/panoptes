"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { IncidentList } from "@/components/dashboard/incident-list";

export default function IncidentsPage() {
  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Active and historical incidents"
      />
      <IncidentList />
    </div>
  );
}
