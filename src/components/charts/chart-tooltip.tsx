"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    color?: string;
  }>;
  label?: string | number;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-deep-iris bg-midnight-plum px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-dusty-lavender/70">
        {labelFormatter ? labelFormatter(String(label)) : String(label)}
      </p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-medium text-mist">
          <span
            className="mr-1.5 inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {formatter
            ? formatter(entry.value as number, entry.name ?? "")
            : entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}
