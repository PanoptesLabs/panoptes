"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { ForecastList } from "@/components/dashboard/forecast-list";

export default function ForecastsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecasts"
        description="Statistical predictions for network health and validator performance"
        breadcrumbs={[{ label: "Forecasts" }]}
      />
      <ForecastList />
    </div>
  );
}
