"use client";

import type { SWRConfiguration } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("API request failed");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

export { fetcher };

export const defaultSwrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  errorRetryCount: 3,
  dedupingInterval: 5000,
};

export const pollingSwrConfig: SWRConfiguration = {
  ...defaultSwrConfig,
  refreshInterval: 30_000,
};

export function createWorkspaceFetcher(token: string | null) {
  return async (url: string) => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const error = new Error("API request failed");
      (error as Error & { status: number }).status = res.status;
      throw error;
    }
    return res.json();
  };
}

export function workspaceSwrConfig(token: string | null): SWRConfiguration {
  return {
    fetcher: createWorkspaceFetcher(token),
    revalidateOnFocus: false,
    errorRetryCount: 3,
    dedupingInterval: 5000,
    onError: (error: Error & { status?: number }) => {
      if (error.status === 401) {
        try {
          localStorage.removeItem("panoptes_workspace_token");
          window.dispatchEvent(new StorageEvent("storage", {
            key: "panoptes_workspace_token",
            newValue: null,
          }));
        } catch {
          // localStorage unavailable
        }
      }
    },
  };
}
