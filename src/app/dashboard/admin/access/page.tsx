"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { AdminAccess } from "@/components/dashboard/admin-access";

export default function AdminAccessPage() {
  return (
    <div>
      <PageHeader
        title="Access Management"
        description="Users, sessions, and API keys"
      />
      <AdminAccess />
    </div>
  );
}
