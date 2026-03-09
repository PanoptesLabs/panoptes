import { PageHeader } from "@/components/dashboard/page-header";
import { Overview } from "@/components/dashboard/overview";

export const metadata = {
  title: "Dashboard | Panoptes",
  description: "Republic chain overview — real-time monitoring",
};

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Republic chain overview — real-time monitoring"
      />
      <Overview />
    </div>
  );
}
