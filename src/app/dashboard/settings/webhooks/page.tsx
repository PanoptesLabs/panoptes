"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WebhookList } from "@/components/dashboard/webhook-list";

export default function WebhooksPage() {
  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Configure webhook notifications"
      />
      <WebhookList />
    </div>
  );
}
