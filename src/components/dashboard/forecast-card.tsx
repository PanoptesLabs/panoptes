"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { PREDICTION_CONFIG, type PredictionLevel } from "@/lib/color-utils";

interface ForecastItem {
  id: string;
  entityType: string;
  entityId: string;
  metric: string;
  prediction: string;
  confidence: number;
  timeHorizon: string;
  currentValue: number;
  predictedValue: number;
  threshold: number | null;
  reasoning: string;
  validUntil: string;
  createdAt: string;
}

interface ForecastCardProps {
  forecast: ForecastItem;
}

const predictionIcons: Record<string, typeof CheckCircle> = {
  normal: CheckCircle,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

const metricLabels: Record<string, string> = {
  latency: "Latency",
  jail_risk: "Jail Risk",
  downtime: "Downtime",
  unbonding: "Unbonding",
  breach_risk: "SLO Breach",
};

export function ForecastCard({ forecast }: ForecastCardProps) {
  const level = (forecast.prediction in PREDICTION_CONFIG ? forecast.prediction : "normal") as PredictionLevel;
  const config = PREDICTION_CONFIG[level];
  const Icon = predictionIcons[level] ?? CheckCircle;

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={cn("size-4 shrink-0", config.iconColor)} />
            <CardTitle className="truncate text-sm font-medium text-mist">
              {metricLabels[forecast.metric] ?? forecast.metric}
            </CardTitle>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0",
              config.classes,
            )}
          >
            {config.label}
            <HelpTooltip content={helpContent.forecasts.concepts.prediction} side="left" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-dusty-lavender/60">{forecast.reasoning}</p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-dusty-lavender/60">
              Confidence
              <HelpTooltip content={helpContent.forecasts.concepts.confidence} side="top" />
            </p>
            <p className="font-mono text-sm font-medium text-mist">
              {forecast.confidence.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-dusty-lavender/60">
              Horizon
              <HelpTooltip content={helpContent.forecasts.concepts.timeHorizon} side="top" />
            </p>
            <p className="font-mono text-sm font-medium text-mist">
              {forecast.timeHorizon}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/60">
              Entity
            </p>
            <p className="font-mono text-xs font-medium text-mist truncate">
              {forecast.entityType}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-dusty-lavender/60">
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {new Date(forecast.validUntil) > new Date()
              ? `Expires ${timeAgo(forecast.validUntil)}`
              : `Expired ${timeAgo(forecast.validUntil)}`}
          </span>
          <span>Created {timeAgo(forecast.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
