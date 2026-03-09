import { cn } from "@/lib/utils";

type StatusType =
  | "bonded"
  | "unbonding"
  | "unbonded"
  | "jailed"
  | "healthy"
  | "unhealthy";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; classes: string }> = {
  bonded: {
    label: "Bonded",
    classes: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30",
  },
  unbonding: {
    label: "Unbonding",
    classes: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  },
  unbonded: {
    label: "Unbonded",
    classes: "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30",
  },
  jailed: {
    label: "Jailed",
    classes: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  },
  healthy: {
    label: "Healthy",
    classes: "bg-teal-dark/50 text-teal-light border-teal-DEFAULT/30",
  },
  unhealthy: {
    label: "Unhealthy",
    classes: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.classes,
        className
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", {
          "bg-teal-DEFAULT": status === "bonded" || status === "healthy",
          "bg-amber-DEFAULT": status === "unbonding",
          "bg-slate-DEFAULT": status === "unbonded",
          "bg-rose-DEFAULT": status === "jailed" || status === "unhealthy",
        })}
      />
      {config.label}
    </span>
  );
}
