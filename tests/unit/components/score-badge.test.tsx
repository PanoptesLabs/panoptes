import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBadge } from "@/components/dashboard/score-badge";

describe("ScoreBadge", () => {
  it("renders correct score value", () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByText("85")).toBeDefined();
  });

  it("renders -- for null score", () => {
    render(<ScoreBadge score={null} />);
    expect(screen.getByText("--")).toBeDefined();
  });

  it("renders green color for high score", () => {
    const { container } = render(<ScoreBadge score={90} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("teal");
  });

  it("renders amber color for medium score", () => {
    const { container } = render(<ScoreBadge score={65} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("amber");
  });

  it("renders rose color for low score", () => {
    const { container } = render(<ScoreBadge score={20} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("rose");
  });

  it("renders gray for null score", () => {
    const { container } = render(<ScoreBadge score={null} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("slate");
  });
});
