"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useKeplr } from "@/hooks/use-keplr";
import type { Role } from "@/lib/constants";

interface AuthUser {
  id: string;
  address: string;
}

interface AuthState {
  user: AuthUser | null;
  role: Role;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginError: string | null;
}

type PendingAction = (() => void) | null;

export function useAuth() {
  const keplr = useKeplr();
  const [state, setState] = useState<AuthState>({
    user: null,
    role: "anonymous",
    isLoading: true,
    isAuthenticated: false,
    loginError: null,
  });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setState({
          user: data.user,
          role: data.role,
          isLoading: false,
          isAuthenticated: !!data.user,
          loginError: null,
        });
        return;
      }
    } catch {
      // Session check failed silently
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  // Check session on mount - checkSession is async so setState is deferred, not synchronous
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, loginError: null }));

    try {
      // 1. Connect Keplr
      const keplrResult = await keplr.connect();
      if (!keplrResult) {
        setState((s) => ({ ...s, isLoading: false, loginError: "Keplr connection failed" }));
        return false;
      }

      // 2. Get nonce
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: keplrResult.address }),
      });

      if (!nonceRes.ok) {
        const errData = await nonceRes.json().catch(() => ({}));
        setState((s) => ({
          ...s,
          isLoading: false,
          loginError: (errData as { error?: string }).error ?? `Nonce request failed (${nonceRes.status})`,
        }));
        return false;
      }

      const { nonce, sessionId } = await nonceRes.json();

      // 3. Sign nonce with Keplr (pass address explicitly to avoid React state timing)
      const signature = await keplr.signArbitrary(nonce, keplrResult.address);
      if (!signature) {
        setState((s) => ({ ...s, isLoading: false, loginError: "Signature rejected or failed" }));
        return false;
      }

      // 4. Verify signature
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: keplrResult.address,
          pubKey: keplrResult.pubKey,
          signature,
          sessionId,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        setState((s) => ({
          ...s,
          isLoading: false,
          loginError: (errData as { error?: string }).error ?? `Verification failed (${verifyRes.status})`,
        }));
        return false;
      }

      const data = await verifyRes.json();
      setState({
        user: data.user,
        role: data.role,
        isLoading: false,
        isAuthenticated: true,
        loginError: null,
      });

      setShowConnectModal(false);

      // Execute pending action if any
      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        setTimeout(action, 0);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setState((s) => ({ ...s, isLoading: false, loginError: message }));
      return false;
    }
  }, [keplr]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Logout request failed, clear local state anyway
    }

    keplr.disconnect();
    setState({
      user: null,
      role: "anonymous",
      isLoading: false,
      isAuthenticated: false,
      loginError: null,
    });
  }, [keplr]);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (state.isAuthenticated) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setShowConnectModal(true);
    },
    [state.isAuthenticated],
  );

  return {
    ...state,
    keplr,
    showConnectModal,
    setShowConnectModal,
    login,
    logout,
    checkSession,
    requireAuth,
  };
}
