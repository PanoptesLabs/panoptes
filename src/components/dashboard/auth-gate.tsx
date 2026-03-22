"use client";

import { useAuthContext } from "@/components/dashboard/auth-provider";
import { ROLE_HIERARCHY } from "@/lib/constants";
import { toast } from "sonner";
import { cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";

interface AuthGateProps {
  children: ReactNode;
  requiredRole?: string;
  onAction?: () => void;
}

/**
 * Action-gate wrapper: injects onClick into the child element.
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

  if (isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <span role="button" tabIndex={0} onClick={handleClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}>
      {children}
    </span>
  );
}
