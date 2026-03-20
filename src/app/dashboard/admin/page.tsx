"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AdminOverview } from "@/components/dashboard/admin-overview";

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Admin"
        description="System overview and administration"
      />
      <AdminOverview />
    </div>
  );
}
