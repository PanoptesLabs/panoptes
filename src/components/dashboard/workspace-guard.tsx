"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, LogOut, Loader2, AlertCircle } from "lucide-react";

interface WorkspaceGuardProps {
  children: React.ReactNode;
}

export function WorkspaceGuard({ children }: WorkspaceGuardProps) {
  const { setToken, clearToken, isAuthenticated } = useWorkspace();
  const [input, setInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/slos/summary", {
        headers: { Authorization: `Bearer ${trimmed}` },
      });

      if (res.status === 401 || res.status === 403) {
        setError("Invalid workspace token");
        setIsValidating(false);
        return;
      }

      if (!res.ok) {
        setError("Connection failed — please try again");
        setIsValidating(false);
        return;
      }

      setToken(trimmed);
      setInput("");
    } catch {
      setError("Network error — check your connection");
    } finally {
      setIsValidating(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearToken}
            className="text-dusty-lavender/50 hover:text-rose-DEFAULT"
          >
            <LogOut className="size-3.5" />
            Disconnect
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-md border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-soft-violet/15">
            <KeyRound className="size-6 text-soft-violet" />
          </div>
          <CardTitle className="text-lg font-medium text-mist">
            Connect Workspace
          </CardTitle>
          <p className="text-sm text-dusty-lavender/50">
            Enter your workspace token to view this section
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              placeholder="Workspace token"
              className="h-10 w-full rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-3 text-sm text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50 focus:ring-1 focus:ring-soft-violet/20"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-DEFAULT">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </div>
          )}
          <Button
            onClick={handleConnect}
            disabled={isValidating || !input.trim()}
            className="w-full bg-soft-violet text-white hover:bg-soft-violet/80 disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
