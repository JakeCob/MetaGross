import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TeamList } from "@/components/team-builder/TeamList";

export default function TeamsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Manage and build your VGC teams.</p>
        </div>
        <Link href="/teams/new" className="sm:self-auto">
          <Button className="w-full sm:w-auto">+ New Team</Button>
        </Link>
      </div>

      <TeamList />
    </div>
  );
}
