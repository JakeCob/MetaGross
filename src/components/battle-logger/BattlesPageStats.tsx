import { Card, CardContent } from "@/components/ui/card";
import { calculateWinRate } from "@/lib/utils/stats";
import { getAllMatches } from "@/lib/db/queries/matches";

/**
 * Server component — reads matches straight from the DB. Rendered inside
 * /battles, which is itself a server component. Previously this was a
 * Client Component that called fetch("/api/matches") via React's
 * use(promise) API; that works in the browser but throws "Failed to
 * parse URL from /api/matches" during the server-render pass because
 * relative URLs aren't resolvable on the server.
 */
export function BattlesPageStats() {
  const matches = getAllMatches()
    .filter((m): m is typeof m & { result: string } => typeof m.result === "string")
    .map((m) => ({ result: m.result as string }));

  const stats = calculateWinRate(matches);
  if (stats.total === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Total Matches
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {stats.total}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Win Rate
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {stats.winRate}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Record
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <span className="text-emerald-400">{stats.wins}</span>
            {" - "}
            <span className="text-red-400">{stats.losses}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
