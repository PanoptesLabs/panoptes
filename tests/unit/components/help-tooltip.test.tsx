import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpTooltip } from "@/components/dashboard/help-tooltip";

describe("HelpTooltip", () => {
  it("renders the info icon", () => {
    const { container } = render(<HelpTooltip content="Test content" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg).not.toBeNull();
  });

  it("has aria-label for accessibility", () => {
    render(<HelpTooltip content="Test content" />);
    const trigger = screen.getByLabelText("More info");
    expect(trigger).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(
      <HelpTooltip content="Test content" className="my-custom-class" />
    );
    const trigger = container.querySelector("[aria-label='More info']");
    expect(trigger?.className).toContain("my-custom-class");
  });

  it("renders with different side props", () => {
    const sides = ["top", "right", "bottom", "left"] as const;
    for (const side of sides) {
      const { unmount } = render(
        <HelpTooltip content={`Side ${side}`} side={side} />
      );
      const trigger = screen.getByLabelText("More info");
      expect(trigger).toBeDefined();
      unmount();
    }
  });

  it("has cursor-help class", () => {
    render(<HelpTooltip content="Test content" />);
    const trigger = screen.getByLabelText("More info");
    expect(trigger.className).toContain("cursor-help");
  });
});
