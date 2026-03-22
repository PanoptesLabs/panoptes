"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="font-display text-2xl font-bold text-rose-DEFAULT">
        Something went wrong
      </h2>
      <p className="mt-3 max-w-md text-sm text-dusty-lavender/70">
        An unexpected error occurred while loading this page.
      </p>
      <button
        onClick={reset}
        autoFocus
        className="mt-6 rounded-lg bg-deep-iris px-5 py-2.5 text-sm font-medium text-mist transition-colors hover:bg-soft-violet"
      >
        Try Again
      </button>
    </div>
  );
}
