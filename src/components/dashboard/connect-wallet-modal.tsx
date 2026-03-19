"use client";

import { Wallet, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<boolean>;
  isConnecting: boolean;
  isKeplrInstalled: boolean;
  error: string | null;
}

export function ConnectWalletModal({
  open,
  onClose,
  onConnect,
  isConnecting,
  isKeplrInstalled,
  error,
}: ConnectWalletModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-sm rounded-xl border border-slate-DEFAULT/20 bg-midnight-plum p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-mist">Connect Wallet</h2>
        <p className="mt-1 text-sm text-dusty-lavender/70">
          Sign in with your Keplr wallet to perform actions.
        </p>

        <div className="mt-5 space-y-3">
          {isKeplrInstalled ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className={cn(
                "flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                isConnecting
                  ? "cursor-not-allowed bg-deep-iris/30 text-dusty-lavender/50"
                  : "bg-soft-violet/20 text-soft-violet hover:bg-soft-violet/30"
              )}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="size-4" />
                  Connect with Keplr
                </>
              )}
            </button>
          ) : (
            <a
              href="https://www.keplr.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-soft-violet/20 px-4 py-3 text-sm font-medium text-soft-violet hover:bg-soft-violet/30 transition-all"
            >
              <ExternalLink className="size-4" />
              Install Keplr Extension
            </a>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-dusty-lavender/50 hover:text-dusty-lavender/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
