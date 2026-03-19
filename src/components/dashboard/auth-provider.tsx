"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ConnectWalletModal } from "@/components/dashboard/connect-wallet-modal";

type AuthContextType = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
      <ConnectWalletModal
        open={auth.showConnectModal}
        onClose={() => auth.setShowConnectModal(false)}
        onConnect={auth.login}
        isConnecting={auth.isLoading}
        isKeplrInstalled={auth.keplr.isInstalled}
        error={auth.loginError || auth.keplr.error}
      />
    </AuthContext.Provider>
  );
}
