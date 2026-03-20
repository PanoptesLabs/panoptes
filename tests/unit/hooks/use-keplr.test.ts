import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeplr } from "@/hooks/use-keplr";

const mockKeplr = {
  experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
  enable: vi.fn().mockResolvedValue(undefined),
  getKey: vi.fn().mockResolvedValue({
    bech32Address: "rai1testaddr123",
    pubKey: new Uint8Array([1, 2, 3, 4]),
    name: "Test Wallet",
  }),
  signArbitrary: vi.fn().mockResolvedValue({ signature: "sig123" }),
};

describe("useKeplr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).keplr = mockKeplr;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).keplr;
  });

  it("detects Keplr installation", () => {
    const { result } = renderHook(() => useKeplr());
    expect(result.current.isInstalled).toBe(true);
  });

  it("detects Keplr not installed", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).keplr;
    const { result } = renderHook(() => useKeplr());
    expect(result.current.isInstalled).toBe(false);
  });

  it("has initial null state", () => {
    const { result } = renderHook(() => useKeplr());
    expect(result.current.address).toBeNull();
    expect(result.current.pubKey).toBeNull();
    expect(result.current.name).toBeNull();
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("connects successfully", async () => {
    const { result } = renderHook(() => useKeplr());

    let connectResult: unknown;
    await act(async () => {
      connectResult = await result.current.connect();
    });

    expect(connectResult).toEqual({
      address: "rai1testaddr123",
      pubKey: expect.any(String),
    });
    expect(result.current.address).toBe("rai1testaddr123");
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles Keplr not found on connect", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).keplr;
    const { result } = renderHook(() => useKeplr());

    let connectResult: unknown;
    await act(async () => {
      connectResult = await result.current.connect();
    });

    expect(connectResult).toBeNull();
    expect(result.current.error).toBe("Keplr extension not found");
  });

  it("handles user rejection on connect", async () => {
    mockKeplr.enable.mockRejectedValueOnce(new Error("Request rejected"));
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBe("Request rejected");
    expect(result.current.address).toBeNull();
  });

  it("suggests chain before enabling", async () => {
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    expect(mockKeplr.experimentalSuggestChain).toHaveBeenCalledTimes(1);
    expect(mockKeplr.enable).toHaveBeenCalledTimes(1);
  });

  it("continues connect even if chain suggestion fails", async () => {
    mockKeplr.experimentalSuggestChain.mockRejectedValueOnce(new Error("rejected"));
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      const res = await result.current.connect();
      expect(res).not.toBeNull();
    });
  });

  it("signs arbitrary data", async () => {
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    let sig: string | null = null;
    await act(async () => {
      sig = await result.current.signArbitrary("test-data");
    });

    expect(sig).toBe("sig123");
    expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
      expect.any(String),
      "rai1testaddr123",
      "test-data",
    );
  });

  it("returns null from signArbitrary when not connected", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).keplr;
    const { result } = renderHook(() => useKeplr());

    let sig: string | null = null;
    await act(async () => {
      sig = await result.current.signArbitrary("test-data");
    });

    expect(sig).toBeNull();
  });

  it("returns null from signArbitrary on error", async () => {
    mockKeplr.signArbitrary.mockRejectedValueOnce(new Error("sign failed"));
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    let sig: string | null = null;
    await act(async () => {
      sig = await result.current.signArbitrary("test-data");
    });

    expect(sig).toBeNull();
  });

  it("disconnects successfully", async () => {
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("rai1testaddr123");

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.pubKey).toBeNull();
    expect(result.current.name).toBeNull();
  });

  it("uses custom signer address for signArbitrary", async () => {
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.signArbitrary("data", "rai1custom");
    });

    expect(mockKeplr.signArbitrary).toHaveBeenCalledWith(
      expect.any(String),
      "rai1custom",
      "data",
    );
  });

  it("converts pubKey to base64", async () => {
    const { result } = renderHook(() => useKeplr());

    await act(async () => {
      await result.current.connect();
    });

    // pubKey should be base64 of Uint8Array([1,2,3,4])
    expect(result.current.pubKey).toBe(btoa(String.fromCharCode(1, 2, 3, 4)));
  });
});
