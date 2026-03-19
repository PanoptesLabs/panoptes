import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock use-keplr
const mockConnect = vi.fn();
const mockSignArbitrary = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("@/hooks/use-keplr", () => ({
  useKeplr: () => ({
    address: null,
    pubKey: null,
    name: null,
    isConnecting: false,
    error: null,
    isInstalled: true,
    connect: mockConnect,
    signArbitrary: mockSignArbitrary,
    disconnect: mockDisconnect,
  }),
}));

import { useAuth } from "@/hooks/use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: /auth/me returns anonymous
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: null, role: "anonymous" }),
    });
  });

  it("checks session on mount", async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/me", expect.any(Object));
    expect(result.current.role).toBe("anonymous");
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("sets authenticated state when session exists", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { id: "u1", address: "rai1abc" },
          role: "member",
        }),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.address).toBe("rai1abc");
    expect(result.current.role).toBe("member");
  });

  it("login calls connect, nonce, sign, verify in sequence", async () => {
    // Session check returns anonymous
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: null, role: "anonymous" }),
    });

    mockConnect.mockResolvedValue({ address: "rai1abc", pubKey: "cHVia2V5" });
    mockSignArbitrary.mockResolvedValue("c2lnbmF0dXJl");

    // Nonce response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ nonce: "testnonce", sessionId: "sid" }),
    });

    // Verify response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { id: "u1", address: "rai1abc" },
          role: "viewer",
        }),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let loginResult: boolean | undefined;
    await act(async () => {
      loginResult = await result.current.login();
    });

    expect(loginResult).toBe(true);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockSignArbitrary).toHaveBeenCalledWith("testnonce", "rai1abc");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("logout clears state and calls disconnect", async () => {
    // Initial session check - authenticated
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { id: "u1", address: "rai1abc" },
          role: "member",
        }),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Logout response
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("returns false when keplr connect fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: null, role: "anonymous" }),
    });

    mockConnect.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let loginResult: boolean | undefined;
    await act(async () => {
      loginResult = await result.current.login();
    });

    expect(loginResult).toBe(false);
  });
});
