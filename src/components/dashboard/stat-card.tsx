"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  sparklineData?: number[];
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  sparklineData,
  isLoading,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24 bg-deep-iris/30" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 bg-deep-iris/30" />
          <Skeleton className="mt-2 h-3 w-32 bg-deep-iris/30" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-dusty-lavender/70">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-dusty-lavender/40">{icon}</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-2xl font-bold text-mist">
              {value}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {trend && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    trend.value >= 0 ? "text-teal-DEFAULT" : "text-rose-DEFAULT"
                  }`}
                >
                  {trend.value >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {trend.label}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-dusty-lavender/50">
                  {subtitle}
                </span>
              )}
            </div>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="shrink-0">
              <Sparkline data={sparklineData} height={36} width={80} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
