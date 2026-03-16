"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface WorkspaceConnectFormProps {
  subtitle?: string;
  showHelp?: boolean;
}

export function WorkspaceConnectForm({
  subtitle = "Enter your workspace token to access this section",
  showHelp = false,
}: WorkspaceConnectFormProps) {
  const { setToken } = useWorkspace();
  const [input, setInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleConnect = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${trimmed}` },
      });

      if (res.status === 401 || res.status === 403) {
        setError("Invalid workspace token");
        return;
      }

      if (!res.ok) {
        setError("Connection failed — please try again");
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
          <p className="text-sm text-dusty-lavender/50">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              placeholder="ws_..."
              aria-label="Workspace token"
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

          {showHelp && (
            <div className="border-t border-slate-DEFAULT/10 pt-3">
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="flex w-full items-center gap-2 text-xs text-dusty-lavender/50 hover:text-dusty-lavender/70"
              >
                {helpOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                How to get a token
              </button>
              {helpOpen && (
                <div className="mt-3 space-y-2 rounded-lg bg-slate-dark/30 p-3 text-xs text-dusty-lavender/60">
                  <p>Create a workspace via the API:</p>
                  <code className="block overflow-x-auto whitespace-pre rounded bg-slate-dark/50 p-2 font-mono text-[10px] text-dusty-lavender/80">
                    {`curl -X POST /api/workspaces \\
  -H "X-Admin-Secret: <secret>" \\
  -d '{"name":"My WS","slug":"my-ws"}'`}
                  </code>
                  <p>
                    The response includes a token with <code className="rounded bg-slate-dark/50 px-1 font-mono">ws_</code> prefix.
                    Save it securely — it cannot be retrieved later.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
