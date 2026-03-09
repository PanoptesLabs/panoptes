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
