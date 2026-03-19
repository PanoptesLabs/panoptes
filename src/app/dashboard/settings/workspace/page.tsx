"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { WorkspaceSettings } from "@/components/dashboard/workspace-settings";

export default function WorkspacePage() {
  return (
    <div>
      <PageHeader
        title="Workspace"
        description="View workspace details and manage settings"
      />
      <WorkspaceSettings />
    </div>
  );
}
