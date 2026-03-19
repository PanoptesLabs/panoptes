"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PolicyList } from "@/components/dashboard/policy-list";

export default function PoliciesPage() {
  return (
    <div>
      <PageHeader
        title="Policies"
        description="Declarative rules for automated responses"
      />
      <PolicyList />
    </div>
  );
}
