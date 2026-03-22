import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsyncAction } from "@/hooks/use-async-action";

describe("useAsyncAction", () => {
  it("starts with idle state", () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets loading during execution", async () => {
    const { result } = renderHook(() => useAsyncAction());
    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    act(() => {
      result.current.execute(() => promise);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!();
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("returns result on success", async () => {
    const { result } = renderHook(() => useAsyncAction<string>());

    let returnValue: string | undefined;
    await act(async () => {
      returnValue = await result.current.execute(async () => "hello");
    });

    expect(returnValue).toBe("hello");
    expect(result.current.error).toBeNull();
  });

  it("sets error on failure", async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("fail");
      }, "Custom error msg");
    });

    expect(result.current.error).toBe("Custom error msg");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns undefined on failure", async () => {
    const { result } = renderHook(() => useAsyncAction());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.execute(async () => {
        throw new Error("fail");
      });
    });

    expect(returnValue).toBeUndefined();
  });

  it("reset clears error", async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("fail");
      });
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
  });
});
