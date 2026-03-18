"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelectProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterSelect({
  label,
  options,
  value,
  onChange,
  className,
}: FilterSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-dusty-lavender/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-11 sm:h-8 rounded-lg border border-slate-DEFAULT/20 bg-midnight-plum px-2.5 text-sm text-mist outline-none focus:border-soft-violet/50 focus:ring-1 focus:ring-soft-violet/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
