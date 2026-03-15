"use client";

import { use } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { WebhookDetail } from "@/components/dashboard/webhook-detail";

export default function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div>
      <PageHeader
        title="Webhook Detail"
        breadcrumbs={[
          { label: "Settings" },
          { label: "Webhooks", href: "/dashboard/settings/webhooks" },
          { label: id.slice(0, 12) + "..." },
        ]}
      />
      <WorkspaceGuard>
        <WebhookDetail webhookId={id} />
      </WorkspaceGuard>
    </div>
  );
}
