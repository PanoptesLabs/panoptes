"use client";

import { useState, useCallback } from "react";

export function useAsyncAction<T = void>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (fn: () => Promise<T>, errorMsg = "Operation failed"): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fn();
        return result;
      } catch {
        setError(errorMsg);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => setError(null), []);

  return { execute, isLoading, error, reset };
}
