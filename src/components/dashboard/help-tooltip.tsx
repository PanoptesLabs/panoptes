"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function HelpTooltip({ content, side = "top", className }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="More info"
        className={cn(
          "inline-flex cursor-help text-dusty-lavender/60 transition-colors hover:text-dusty-lavender/70",
          className,
        )}
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipPositioner side={side} sideOffset={6}>
          <TooltipPopup>{content}</TooltipPopup>
        </TooltipPositioner>
      </TooltipPortal>
    </Tooltip>
  );
}
