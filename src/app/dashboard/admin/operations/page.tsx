"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AdminOperations } from "@/components/dashboard/admin-operations";

export default function AdminOperationsPage() {
  return (
    <div>
      <PageHeader
        title="Operations"
        description="Webhooks, policies, and incidents"
      />
      <AdminOperations />
    </div>
  );
}
