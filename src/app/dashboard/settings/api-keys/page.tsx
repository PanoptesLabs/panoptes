"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";
import { ApiKeyList } from "@/components/dashboard/api-key-list";

export default function ApiKeysPage() {
  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Manage API keys for external access"
      />
      <WorkspaceGuard>
        <ApiKeyList />
      </WorkspaceGuard>
    </div>
  );
}
