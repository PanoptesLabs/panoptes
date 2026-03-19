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

const sessionFetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const error = new Error("API request failed");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

export { sessionFetcher };

export const sessionSwrConfig: SWRConfiguration = {
  fetcher: sessionFetcher,
  revalidateOnFocus: false,
  errorRetryCount: 3,
  dedupingInterval: 5000,
};

export async function sessionMutate<T = void>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const headers: HeadersInit = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
