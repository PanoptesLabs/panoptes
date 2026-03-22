import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockRequireAuth = vi.fn();
const mockAuthContext = {
  isAuthenticated: true,
  role: "admin",
  requireAuth: mockRequireAuth,
  logout: vi.fn(),
  setShowConnectModal: vi.fn(),
  showConnectModal: false,
};

vi.mock("@/components/dashboard/auth-provider", () => ({
  useAuthContext: () => mockAuthContext,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { AuthGate } from "@/components/dashboard/auth-gate";
import { toast } from "sonner";

describe("AuthGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.role = "admin";
  });

  it("calls onAction when authenticated with sufficient role", () => {
    const onAction = vi.fn();
    render(
      <AuthGate requiredRole="member" onAction={onAction}>
        <button>Do something</button>
      </AuthGate>,
    );
    fireEvent.click(screen.getByText("Do something"));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("injects onClick into child element via cloneElement", () => {
    const onAction = vi.fn();
    const { container } = render(
      <AuthGate onAction={onAction}>
        <button>Click me</button>
      </AuthGate>,
    );
    // Should not wrap with a div[role=button]
    expect(container.querySelector("div[role='button']")).toBeNull();
    fireEvent.click(screen.getByText("Click me"));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("opens connect modal when not authenticated", () => {
    mockAuthContext.isAuthenticated = false;
    const onAction = vi.fn();
    render(
      <AuthGate onAction={onAction}>
        <button>Protected</button>
      </AuthGate>,
    );
    fireEvent.click(screen.getByText("Protected"));
    expect(mockRequireAuth).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("shows toast when role is insufficient", () => {
    mockAuthContext.role = "viewer";
    const onAction = vi.fn();
    render(
      <AuthGate requiredRole="admin" onAction={onAction}>
        <button>Admin only</button>
      </AuthGate>,
    );
    fireEvent.click(screen.getByText("Admin only"));
    expect(toast.error).toHaveBeenCalledWith("Insufficient permissions for this action");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("wraps non-element children with a span fallback", () => {
    const { container } = render(
      <AuthGate onAction={() => {}}>
        plain text
      </AuthGate>,
    );
    const span = container.querySelector("span[role='button']");
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("plain text");
  });
});
