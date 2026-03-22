"use client";

import { useAuthContext } from "@/components/dashboard/auth-provider";
import { ROLE_HIERARCHY } from "@/lib/constants";
import { toast } from "sonner";
import type { ReactNode } from "react";

interface AuthGateProps {
  children: ReactNode;
  requiredRole?: string;
  onAction?: () => void;
}

/**
 * Action-gate wrapper: wraps a button/action that requires authentication.
 * - Unauthenticated: opens connect modal
 * - Insufficient role: shows toast
 * - Sufficient role: calls onAction
 */
export function AuthGate({ children, requiredRole = "member", onAction }: AuthGateProps) {
  const { isAuthenticated, role, requireAuth } = useAuthContext();

  const handleClick = () => {
    if (!isAuthenticated) {
      requireAuth(() => onAction?.());
      return;
    }

    const currentLevel = ROLE_HIERARCHY[role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? Infinity;

    if (currentLevel < requiredLevel) {
      toast.error("Insufficient permissions for this action");
      return;
    }

    onAction?.();
  };

  return (
    <button type="button" onClick={handleClick} className="contents">
      {children}
    </button>
  );
}
