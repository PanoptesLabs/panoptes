"use client";

import { useClipboard } from "@/hooks/use-clipboard";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copied, copy } = useClipboard();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copy(text);
      }}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-dusty-lavender/50 transition-colors hover:bg-deep-iris/20 hover:text-dusty-lavender",
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3.5 text-teal-DEFAULT" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
