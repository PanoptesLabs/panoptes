import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceGuard } from "@/components/dashboard/workspace-guard";

// Mock useWorkspace hook
const mockSetToken = vi.fn();
const mockClearToken = vi.fn();
let mockToken: string | null = null;

vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({
    token: mockToken,
    setToken: mockSetToken,
    clearToken: mockClearToken,
    isAuthenticated: mockToken !== null,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("WorkspaceGuard", () => {
  beforeEach(() => {
    mockToken = null;
    mockSetToken.mockClear();
    mockClearToken.mockClear();
    mockFetch.mockClear();
  });

  it("shows token input form when not authenticated", () => {
    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );
    expect(screen.getByText("Connect Workspace")).toBeDefined();
    expect(screen.getByPlaceholderText("Workspace token")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("renders children when authenticated", () => {
    mockToken = "valid-token";
    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );
    expect(screen.getByText("Protected Content")).toBeDefined();
    expect(screen.queryByText("Connect Workspace")).toBeNull();
  });

  it("validates token on connect", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );

    const input = screen.getByPlaceholderText("Workspace token");
    fireEvent.change(input, { target: { value: "my-token" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/slos/summary", {
        headers: { Authorization: "Bearer my-token" },
      });
    });

    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith("my-token");
    });
  });

  it("shows error for invalid token (401)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );

    const input = screen.getByPlaceholderText("Workspace token");
    fireEvent.change(input, { target: { value: "bad-token" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Invalid workspace token")).toBeDefined();
    });

    expect(mockSetToken).not.toHaveBeenCalled();
  });

  it("shows disconnect button when authenticated", () => {
    mockToken = "valid-token";
    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );

    const disconnectBtn = screen.getByText("Disconnect");
    expect(disconnectBtn).toBeDefined();

    fireEvent.click(disconnectBtn);
    expect(mockClearToken).toHaveBeenCalled();
  });

  it("shows loading state during validation", async () => {
    let resolvePromise: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(
      <WorkspaceGuard>
        <div>Protected Content</div>
      </WorkspaceGuard>,
    );

    const input = screen.getByPlaceholderText("Workspace token");
    fireEvent.change(input, { target: { value: "test-token" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Validating...")).toBeDefined();
    });

    // Resolve to clean up
    resolvePromise!({ ok: true, status: 200 });
  });
});
