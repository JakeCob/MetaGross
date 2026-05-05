import { TeamBuilderWithAgent } from "@/components/team-builder/TeamBuilderWithAgent";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:py-8">
      <TeamBuilderWithAgent teamId={id} />
    </div>
  );
}
