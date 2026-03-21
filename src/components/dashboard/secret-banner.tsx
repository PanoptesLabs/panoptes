"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, X } from "lucide-react";
import type { ReactNode } from "react";

interface SecretBannerProps {
  title: string;
  value: string;
  helpContent?: ReactNode;
  onDismiss: () => void;
}

export function SecretBanner({ title, value, helpContent, onDismiss }: SecretBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-teal-DEFAULT/30 bg-teal-dark/10">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-medium text-teal-light">
              {title}
              {helpContent}
            </p>
            <p className="mt-1 text-xs text-teal-light/60">
              Copy this now &mdash; it won&apos;t be shown again.
            </p>
            <code className="mt-2 block break-all rounded bg-slate-dark/50 px-3 py-2 font-mono text-xs text-mist">
              {value}
            </code>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-teal-light hover:bg-teal-dark/30"
            >
              {copied ? <CheckCircle className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-teal-light/50 hover:bg-teal-dark/30"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
