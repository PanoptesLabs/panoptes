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

const swrConfigCache = new Map<string | null, SWRConfiguration>();

export function workspaceSwrConfig(token: string | null): SWRConfiguration {
  const cached = swrConfigCache.get(token);
  if (cached) return cached;

  const config: SWRConfiguration = {
    fetcher: createWorkspaceFetcher(token),
    revalidateOnFocus: false,
    errorRetryCount: 3,
    dedupingInterval: 5000,
    onError: (error: Error & { status?: number }) => {
      if (error.status === 401) {
        swrConfigCache.delete(token);
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

  swrConfigCache.set(token, config);
  return config;
}

export async function workspaceMutate<T = void>(
  token: string,
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const headers: HeadersInit = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
