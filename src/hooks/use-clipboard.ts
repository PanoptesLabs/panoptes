"use client";

import { useState, useCallback } from "react";

export function useClipboard(timeout: number = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } catch {
        // Silently fail — clipboard access may be denied
      }
    },
    [timeout]
  );

  return { copied, copy };
}
