import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectWalletModal } from "@/components/dashboard/connect-wallet-modal";

describe("ConnectWalletModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConnect: vi.fn().mockResolvedValue(true),
    isConnecting: false,
    isKeplrInstalled: true,
    error: null,
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConnectWalletModal {...defaultProps} open={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders connect button when Keplr is installed", () => {
    render(<ConnectWalletModal {...defaultProps} />);
    expect(screen.getByText("Connect with Keplr")).toBeDefined();
  });

  it("renders install link when Keplr is not installed", () => {
    render(<ConnectWalletModal {...defaultProps} isKeplrInstalled={false} />);
    expect(screen.getByText("Install Keplr Extension")).toBeDefined();
  });

  it("shows loading state when connecting", () => {
    render(<ConnectWalletModal {...defaultProps} isConnecting={true} />);
    expect(screen.getByText("Connecting...")).toBeDefined();
  });

  it("shows error message", () => {
    render(<ConnectWalletModal {...defaultProps} error="Connection rejected" />);
    expect(screen.getByText("Connection rejected")).toBeDefined();
  });

  it("calls onConnect when button clicked", () => {
    render(<ConnectWalletModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Connect with Keplr"));
    expect(defaultProps.onConnect).toHaveBeenCalled();
  });

  it("calls onClose when cancel clicked", () => {
    render(<ConnectWalletModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
