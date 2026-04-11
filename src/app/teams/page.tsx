import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TeamList } from "@/components/team-builder/TeamList";

export default function TeamsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Teams</h1>
          <p className="mt-1 text-muted-foreground">Manage and build your VGC teams.</p>
        </div>
        <Link href="/teams/new">
          <Button>+ New Team</Button>
        </Link>
      </div>

      <TeamList />
    </div>
  );
}
