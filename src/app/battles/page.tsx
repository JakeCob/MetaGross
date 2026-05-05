import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchList } from "@/components/battle-logger/MatchList";
import { BattlesPageStats } from "@/components/battle-logger/BattlesPageStats";

export const dynamic = "force-dynamic";

export default function BattlesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Match History</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Review past battles and track your progress.
          </p>
        </div>
        <Link href="/battles/new" className="sm:self-auto">
          <Button className="w-full sm:w-auto">+ Log Battle</Button>
        </Link>
      </div>

      <BattlesPageStats />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchList />
        </CardContent>
      </Card>
    </div>
  );
}
