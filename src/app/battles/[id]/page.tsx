import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMatchById } from "@/lib/db/queries/matches";
import { DeleteMatchButton } from "@/components/battle-logger/DeleteMatchButton";

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function modeLabel(mode: string | null): string {
  switch (mode) {
    case "realtime":
      return "Real-Time";
    case "postmatch":
      return "Post-Match";
    case "quick":
      return "Quick Log";
    default:
      return mode ?? "Unknown";
  }
}

interface PokemonInfo {
  species: string;
  item?: string;
  ability?: string;
}

function parsePokemonList(raw: unknown): PokemonInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    if (typeof p === "string") return { species: p };
    if (p && typeof p === "object") {
      const obj = p as Record<string, unknown>;
      return {
        species: (obj.species as string) ?? "Unknown",
        item: (obj.item as string) ?? undefined,
        ability: (obj.ability as string) ?? undefined,
      };
    }
    return { species: "Unknown" };
  });
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getMatchById(id);

  if (!match) {
    notFound();
  }

  const isWin = match.result === "win";
  const myTeam = parsePokemonList(match.myTeam);
  const opponentTeam = parsePokemonList(match.opponentTeam);
  const myBrought = parseStringArray(match.myBrought);
  const oppBrought = parseStringArray(match.opponentBrought);
  const myLeads = parseStringArray(match.myLeads);
  const oppLeads = parseStringArray(match.opponentLeads);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Match Detail</h1>
            <Badge variant={isWin ? "success" : "error"} className="text-sm">
              {isWin ? "Win" : "Loss"}
            </Badge>
          </div>
          <p className="mt-1 text-muted">{formatDate(match.playedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/battles/${id}/analysis`}>
            <Button variant="outline">View Analysis</Button>
          </Link>
          <DeleteMatchButton matchId={id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Match summary */}
          <Card>
            <CardHeader>
              <CardTitle>Match Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted">Result</span>
                  <div className="mt-1">
                    <Badge variant={isWin ? "success" : "error"}>
                      {isWin ? "Win" : "Loss"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted">Mode</span>
                  <p className="mt-1 font-medium text-foreground">
                    {modeLabel(match.mode)}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Format</span>
                  <p className="mt-1 font-medium text-foreground">
                    {match.format ?? "Unknown"}
                  </p>
                </div>
                {match.opponentName && (
                  <div>
                    <span className="text-muted">Opponent</span>
                    <p className="mt-1 font-medium text-foreground">
                      {match.opponentName}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* My Team */}
          <Card>
            <CardHeader>
              <CardTitle>My Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {myTeam.map((mon, i) => {
                  const wasBrought = myBrought.includes(mon.species);
                  const wasLead = myLeads.includes(mon.species);
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col rounded-lg border p-3 transition-colors ${
                        wasBrought
                          ? "border-accent/40 bg-accent/5"
                          : "border-card-border bg-card opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {mon.species}
                        </span>
                        {wasLead && (
                          <Badge
                            variant="success"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Lead
                          </Badge>
                        )}
                      </div>
                      {mon.item && (
                        <span className="text-xs text-muted mt-0.5">
                          {mon.item}
                        </span>
                      )}
                      {!wasBrought && (
                        <span className="text-[10px] text-muted mt-0.5">
                          Not brought
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Opponent Team */}
          <Card>
            <CardHeader>
              <CardTitle>Opponent Team</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {opponentTeam.map((mon, i) => {
                  const wasBrought = oppBrought.includes(mon.species);
                  const wasLead = oppLeads.includes(mon.species);
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col rounded-lg border p-3 transition-colors ${
                        wasBrought
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-card-border bg-card opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {mon.species}
                        </span>
                        {wasLead && (
                          <Badge
                            variant="warning"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Lead
                          </Badge>
                        )}
                      </div>
                      {mon.item && (
                        <span className="text-xs text-muted mt-0.5">
                          {mon.item}
                        </span>
                      )}
                      {mon.ability && (
                        <span className="text-xs text-muted mt-0.5">
                          {mon.ability}
                        </span>
                      )}
                      {!wasBrought && (
                        <span className="text-[10px] text-muted mt-0.5">
                          Not brought
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Turn-by-turn placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Turn-by-Turn</CardTitle>
            </CardHeader>
            <CardContent>
              {match.turns.length > 0 ? (
                <div className="space-y-2">
                  {match.turns.map((turn) => (
                    <div
                      key={turn.id}
                      className="rounded-md border border-card-border bg-background p-2 text-xs"
                    >
                      <span className="font-medium">
                        Turn {turn.turnNumber}
                      </span>
                      <span className="text-muted ml-2">
                        {turn.actions.length} action
                        {turn.actions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No turn data recorded. Turn-by-turn logging will be
                  available in a future update.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Player Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {match.notes ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {match.notes}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  No notes recorded for this match.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Back link */}
          <Link href="/battles">
            <Button variant="outline" className="w-full">
              Back to Match History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
