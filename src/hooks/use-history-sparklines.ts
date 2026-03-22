"use client";

import { useMemo } from "react";
import { tokensToNumber } from "@/lib/formatters";

interface HistoryEntry {
  totalStaked: string;
  blockHeight: string;
  activeValidators: number;
}

export function useHistorySparklines(history: HistoryEntry[]) {
  const stakingSparkline = useMemo(
    () => history.slice().reverse().map((h) => tokensToNumber(h.totalStaked)),
    [history],
  );
  const blockSparkline = useMemo(
    () => history.slice().reverse().map((h) => Number(h.blockHeight)),
    [history],
  );
  const validatorSparkline = useMemo(
    () => history.slice().reverse().map((h) => h.activeValidators),
    [history],
  );

  return { stakingSparkline, blockSparkline, validatorSparkline };
}
