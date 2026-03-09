import { ValidatorDetail } from "@/components/dashboard/validator-detail";

export default async function ValidatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ValidatorDetail validatorId={id} />;
}
