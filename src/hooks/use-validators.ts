"use client";

import useSWR from "swr";
import { defaultSwrConfig } from "./use-api";
import type {
  ValidatorApiResponse,
  ValidatorDetailResponse,
} from "@/types";

interface UseValidatorsParams {
  status?: string;
  jailed?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export function useValidators(params?: UseValidatorsParams) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.jailed !== undefined)
    searchParams.set("jailed", String(params.jailed));
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const qs = searchParams.toString();
  const url = `/api/validators${qs ? `?${qs}` : ""}`;

  return useSWR<ValidatorApiResponse>(url, {
    ...defaultSwrConfig,
    refreshInterval: 60_000,
  });
}

interface UseValidatorDetailOptions {
  from?: string;
  to?: string;
  limit?: number;
}

export function useValidatorDetail(
  id: string,
  options?: UseValidatorDetailOptions
) {
  const searchParams = new URLSearchParams();
  if (options?.from) searchParams.set("from", options.from);
  if (options?.to) searchParams.set("to", options.to);
  if (options?.limit) searchParams.set("limit", String(options.limit));

  const qs = searchParams.toString();
  const url = id ? `/api/validators/${id}${qs ? `?${qs}` : ""}` : null;

  return useSWR<ValidatorDetailResponse>(url, defaultSwrConfig);
}
