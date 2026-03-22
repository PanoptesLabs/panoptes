import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHistorySparklines } from "@/hooks/use-history-sparklines";

describe("useHistorySparklines", () => {
  it("returns empty arrays for empty history", () => {
    const { result } = renderHook(() => useHistorySparklines([]));

    expect(result.current.stakingSparkline).toEqual([]);
    expect(result.current.blockSparkline).toEqual([]);
    expect(result.current.validatorSparkline).toEqual([]);
  });

  it("returns correct length arrays from history entries", () => {
    const history = [
      { totalStaked: "1000000000000000000", blockHeight: "100", activeValidators: 10 },
      { totalStaked: "2000000000000000000", blockHeight: "200", activeValidators: 20 },
      { totalStaked: "3000000000000000000", blockHeight: "300", activeValidators: 30 },
    ];

    const { result } = renderHook(() => useHistorySparklines(history));

    expect(result.current.stakingSparkline).toHaveLength(3);
    expect(result.current.blockSparkline).toHaveLength(3);
    expect(result.current.validatorSparkline).toHaveLength(3);
  });

  it("reverses history order for sparkline data", () => {
    const history = [
      { totalStaked: "3000000000000000000", blockHeight: "300", activeValidators: 30 },
      { totalStaked: "1000000000000000000", blockHeight: "100", activeValidators: 10 },
    ];

    const { result } = renderHook(() => useHistorySparklines(history));

    // reversed: index 0 should be the last history entry
    expect(result.current.blockSparkline[0]).toBe(100);
    expect(result.current.blockSparkline[1]).toBe(300);
    expect(result.current.validatorSparkline[0]).toBe(10);
    expect(result.current.validatorSparkline[1]).toBe(30);
  });

  it("converts staking tokens to numbers", () => {
    const history = [
      { totalStaked: "5000000000000000000", blockHeight: "500", activeValidators: 50 },
    ];

    const { result } = renderHook(() => useHistorySparklines(history));

    // 5000000000000000000 aRAI = 5 RAI
    expect(result.current.stakingSparkline[0]).toBe(5);
  });

  it("memoizes result for same input", () => {
    const history = [
      { totalStaked: "1000000000000000000", blockHeight: "100", activeValidators: 10 },
    ];

    const { result, rerender } = renderHook(() => useHistorySparklines(history));
    const first = result.current;

    rerender();
    const second = result.current;

    expect(first.stakingSparkline).toBe(second.stakingSparkline);
    expect(first.blockSparkline).toBe(second.blockSparkline);
    expect(first.validatorSparkline).toBe(second.validatorSparkline);
  });
});
