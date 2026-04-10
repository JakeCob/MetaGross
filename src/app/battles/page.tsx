import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchList } from "@/components/battle-logger/MatchList";
import { BattlesPageStats } from "@/components/battle-logger/BattlesPageStats";

export const dynamic = "force-dynamic";

export default function BattlesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Match History</h1>
          <p className="mt-1 text-muted">
            Review past battles and track your progress.
          </p>
        </div>
        <Link href="/battles/new">
          <Button>+ Log Battle</Button>
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
