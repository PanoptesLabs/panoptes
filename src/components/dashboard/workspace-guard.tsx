"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { WorkspaceConnectForm } from "./workspace-connect-form";
import { LogOut } from "lucide-react";

interface WorkspaceGuardProps {
  children: React.ReactNode;
}

export function WorkspaceGuard({ children }: WorkspaceGuardProps) {
  const { clearToken, isAuthenticated } = useWorkspace();

  if (isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearToken}
            className="text-dusty-lavender/50 hover:text-rose-DEFAULT"
          >
            <LogOut className="size-3.5" />
            Disconnect
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return <WorkspaceConnectForm />;
}
