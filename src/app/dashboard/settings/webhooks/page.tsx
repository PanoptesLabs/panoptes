"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { WebhookList } from "@/components/dashboard/webhook-list";

export default function WebhooksPage() {
  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Configure webhook notifications"
        breadcrumbs={[
          { label: "Settings" },
          { label: "Webhooks" },
        ]}
      />
      <WorkspaceGuard>
        <WebhookList />
      </WorkspaceGuard>
    </div>
  );
}
