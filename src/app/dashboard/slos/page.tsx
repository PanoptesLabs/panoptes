"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SloList } from "@/components/dashboard/slo-list";

export default function SlosPage() {
  return (
    <div>
      <PageHeader
        title="SLOs"
        description="Service Level Objectives — reliability targets"
      />
      <SloList />
    </div>
  );
}
