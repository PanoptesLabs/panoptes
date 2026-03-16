"use client";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="flex size-10 items-center justify-center rounded-full bg-dusty-lavender/10">
        {icon}
      </div>
      <p className="text-sm font-medium text-mist">{title}</p>
      {description && (
        <p className="max-w-xs text-center text-xs text-dusty-lavender/50">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-2 border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
