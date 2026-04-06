import { PageHeader } from "@/components/dashboard/page-header";
import { NetworkOverview } from "@/components/dashboard/network-overview";
import { NetworkActivity } from "@/components/dashboard/network-activity";

export const metadata = {
  title: "Network | Panoptes",
  description: "Republic chain network statistics and trend analysis",
};

export default function NetworkPage() {
  return (
    <div>
      <PageHeader
        title="Network"
        description="Chain statistics, validator trends, and staking analytics"
      />
      <NetworkOverview />
      <div className="mt-6">
        <NetworkActivity />
      </div>
    </div>
  );
}
