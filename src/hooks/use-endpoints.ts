"use client";

import useSWR from "swr";
import { pollingSwrConfig, defaultSwrConfig } from "./use-api";
import type { EndpointApiResponse, BestEndpointResponse } from "@/types";

export function useEndpoints() {
  return useSWR<EndpointApiResponse>("/api/endpoints", pollingSwrConfig);
}

export function useBestEndpoint(type?: string) {
  const url = type
    ? `/api/endpoints/best?type=${type}`
    : "/api/endpoints/best";
  return useSWR<BestEndpointResponse>(url, defaultSwrConfig);
}
