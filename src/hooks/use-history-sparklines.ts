"use client";

import { useMemo } from "react";
import { tokensToNumber } from "@/lib/formatters";

interface HistoryEntry {
  totalStaked: string;
  blockHeight: string;
  activeValidators: number;
}

interface TrendDelta {
  value: number;
  label: string;
}

function computeTrend(data: number[]): TrendDelta | undefined {
  if (data.length < 2) return undefined;
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0) return undefined;
  const pct = ((last - first) / Math.abs(first)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { value: pct, label: `${sign}${pct.toFixed(1)}% 24h` };
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

  const stakingTrend = useMemo(() => computeTrend(stakingSparkline), [stakingSparkline]);
  const validatorTrend = useMemo(() => computeTrend(validatorSparkline), [validatorSparkline]);

  return { stakingSparkline, blockSparkline, validatorSparkline, stakingTrend, validatorTrend };
}
