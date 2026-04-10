import { TeamBuilder } from "@/components/team-builder/TeamBuilder";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Team</h1>
        <p className="mt-1 text-muted">
          Modify team members, EVs, moves, and items.
        </p>
      </div>

      <TeamBuilder teamId={id} />
    </div>
  );
}
