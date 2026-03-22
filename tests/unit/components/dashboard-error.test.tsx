import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "@/app/dashboard/error";

describe("DashboardError", () => {
  it("renders error message", () => {
    const error = new Error("Test failure");
    render(<DashboardError error={error} reset={() => {}} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText(/unexpected error/i)).toBeDefined();
  });

  it("calls reset on retry button click", () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("retry button has autoFocus", () => {
    const { container } = render(<DashboardError error={new Error("fail")} reset={() => {}} />);
    const button = container.querySelector("button");
    expect(button).toBeDefined();
    expect(button?.textContent).toBe("Try Again");
  });

  it("logs error to console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Logged error");
    render(<DashboardError error={error} reset={() => {}} />);
    expect(consoleSpy).toHaveBeenCalledWith("[DashboardError]", error);
    consoleSpy.mockRestore();
  });
});
