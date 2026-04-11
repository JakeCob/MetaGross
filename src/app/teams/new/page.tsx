import { TeamBuilder } from "@/components/team-builder/TeamBuilder";

export default function NewTeamPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Build New Team</h1>
        <p className="mt-1 text-muted-foreground">
          Create a new VGC team from scratch or import a paste.
        </p>
      </div>

      <TeamBuilder />
    </div>
  );
}
