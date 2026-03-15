"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "panoptes_workspace_token";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function useWorkspace() {
  const externalToken = useSyncExternalStore(subscribe, getStoredToken, () => null);
  const [localToken, setLocalToken] = useState<string | null>(null);

  // Sync external token changes
  const token = localToken ?? externalToken;

  const setToken = useCallback((value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // localStorage unavailable
    }
    setLocalToken(value);
  }, []);

  const clearToken = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
    setLocalToken(null);
  }, []);

  return {
    token,
    setToken,
    clearToken,
    isAuthenticated: token !== null,
  };
}
