"use client";

import useSWR from "swr";
import { pollingSwrConfig } from "./use-api";
import type {
  YaciJailingEvent,
  YaciValidatorSigningStats,
  YaciValidatorReward,
} from "@/types";

export function useValidatorJailing(validatorId: string | null) {
  const url = validatorId ? `/api/validators/${validatorId}/jailing` : null;
  return useSWR<YaciJailingEvent[]>(url, pollingSwrConfig);
}

export function useValidatorSigning(validatorId: string | null) {
  const url = validatorId ? `/api/validators/${validatorId}/signing` : null;
  return useSWR<YaciValidatorSigningStats>(url, pollingSwrConfig);
}

export function useValidatorRewards(validatorId: string | null) {
  const url = validatorId ? `/api/validators/${validatorId}/rewards` : null;
  return useSWR<YaciValidatorReward[]>(url, pollingSwrConfig);
}
