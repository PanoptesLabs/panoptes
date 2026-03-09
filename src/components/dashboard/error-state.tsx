"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Failed to load data",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-dark/30">
        <AlertTriangle className="size-6 text-rose-DEFAULT" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-mist">{message}</p>
        <p className="mt-1 text-xs text-dusty-lavender/50">
          Please try again or check your connection
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-slate-DEFAULT/20 bg-midnight-plum text-dusty-lavender hover:bg-deep-iris/20"
        >
          <RefreshCw className="size-3.5" />
          Try Again
        </Button>
      )}
    </div>
  );
}
