"use client";

import { use } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
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
      />
      <WebhookDetail webhookId={id} />
    </div>
  );
}
