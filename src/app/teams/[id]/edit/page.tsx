import { TeamBuilder } from "@/components/team-builder/TeamBuilder";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <TeamBuilder teamId={id} />
    </div>
  );
}
