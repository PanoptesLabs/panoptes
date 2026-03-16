"use client";

import { useApiKeyUsage } from "@/hooks/use-api-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ApiKeyUsageProps {
  keyId: string;
}

export function ApiKeyUsage({ keyId }: ApiKeyUsageProps) {
  const { data, isLoading } = useApiKeyUsage(keyId);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="size-5 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
      </div>
    );
  }

  const dailyData = data.usage.daily.slice(0, 14).reverse().map((d) => ({
    date: d.period.slice(5),
    count: d.count,
  }));

  return (
    <div className="space-y-4">
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-mist">Daily Usage (last 14 days)</CardTitle>
          <p className="text-xs text-dusty-lavender/50">
            Quota: {data.dailyQuota.toLocaleString()} / day
          </p>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <p className="py-6 text-center text-xs text-dusty-lavender/40">No usage data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(180, 170, 210, 0.5)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(180, 170, 210, 0.5)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1035",
                    border: "1px solid rgba(120, 100, 180, 0.2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e0d8f0" }}
                />
                <Bar dataKey="count" fill="rgba(139, 92, 246, 0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
