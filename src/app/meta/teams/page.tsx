import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listMetaTeams, countMetaTeams } from "@/lib/meta-teams/queries";
import { MetaTeamCard } from "@/components/meta-teams/MetaTeamCard";
import { SubmitMetaTeamForm } from "@/components/meta-teams/SubmitMetaTeamForm";

export const metadata = {
  title: "Meta Teams — MetaGross",
  description:
    "Known tournament teams, creator teams, and community submissions — matched against opponents at OTS entry.",
};

export const dynamic = "force-dynamic";

export default async function MetaTeamsPage() {
  const format = "champions-reg-m-a";
  const [teams, counts] = await Promise.all([
    listMetaTeams(format, 60),
    countMetaTeams(format),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meta Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.total} teams in the pool —{" "}
            {Object.entries(counts.bySource)
              .map(([s, n]) => `${n} ${s}`)
              .join(", ") || "empty"}
            . Matched against opponents at OTS entry.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/meta">
            <Button variant="outline">Back to Meta</Button>
          </Link>
          <form action="/api/meta-teams/aggregate" method="POST">
            <Button type="submit" variant="default">
              Pull from Pikalytics
            </Button>
          </form>
        </div>
      </header>

      <SubmitMetaTeamForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          Recent teams
        </h2>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teams yet. Click <strong>Pull from Pikalytics</strong> above to
            fill the pool from tournament featured-team data.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <MetaTeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
