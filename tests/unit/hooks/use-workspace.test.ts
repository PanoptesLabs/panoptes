import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspace } from "@/hooks/use-workspace";

const STORAGE_KEY = "panoptes_workspace_token";

describe("useWorkspace", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => storage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        storage[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key: string) => {
        delete storage[key];
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with null token when localStorage is empty", () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("reads token from localStorage on mount", () => {
    storage[STORAGE_KEY] = "test-token-123";
    renderHook(() => useWorkspace());
    // useSyncExternalStore calls getStoredToken which calls getItem
    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("setToken stores in localStorage and updates state", () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.setToken("new-token");
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "new-token");
    expect(result.current.token).toBe("new-token");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("clearToken removes from localStorage and resets state", () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.setToken("my-token");
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.clearToken();
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("isAuthenticated reflects token presence", () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.setToken("abc");
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.clearToken();
    });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("handles localStorage errors gracefully", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage disabled");
    });
    // Should not throw
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.token).toBeNull();
  });

  it("listens for cross-tab storage events", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      // Simulate cross-tab update: update localStorage first, then fire event
      storage[STORAGE_KEY] = "cross-tab-token";
      const event = new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: "cross-tab-token",
      });
      window.dispatchEvent(event);
    });

    expect(result.current.token).toBe("cross-tab-token");
  });

  it("ignores storage events for other keys", () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      storage["other_key"] = "some-value";
      const event = new StorageEvent("storage", {
        key: "other_key",
        newValue: "some-value",
      });
      window.dispatchEvent(event);
    });

    expect(result.current.token).toBeNull();
  });
});
